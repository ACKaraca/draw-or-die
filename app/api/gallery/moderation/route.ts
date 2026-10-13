import { NextResponse, type NextRequest } from 'next/server';
import { Query } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_GALLERY_ID,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  isVerifiedAdmin,
  type AppwriteAuthUser,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError, logServerInfo } from '@/lib/logger';
import { cleanupGalleryUpload } from '@/lib/gallery-storage-cleanup';
import type { GalleryRow } from '@/lib/gallery-rows';

const MAX_QUEUE_SIZE = 100;
const MAX_NOTE_LENGTH = 500;

type ModeratorAction = 'APPROVE' | 'REJECT';

type ModeratorCheck =
  | { isAllowed: true; user: AppwriteAuthUser }
  | { isAllowed: false; response: NextResponse };

async function requireModerator(request: NextRequest, action: string): Promise<ModeratorCheck> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return { isAllowed: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!isVerifiedAdmin(user)) {
    logServerInfo('api.gallery.moderation.audit', { actorId: user.id, action, result: 'forbidden' });
    return { isAllowed: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { isAllowed: true, user };
}

/** Moderator review queue: pending submissions only. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireModerator(request, 'LIST_QUEUE');
    if (!auth.isAllowed) return auth.response;

    await ensureCoreAppwriteResources();

    const result = await getAdminTables().listRows<GalleryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_GALLERY_ID,
      queries: [Query.equal('status', 'pending'), Query.orderAsc('$createdAt'), Query.limit(MAX_QUEUE_SIZE)],
      total: true,
    });

    return NextResponse.json({
      items: result.rows.map((row) => ({
        id: row.$id,
        title: row.title,
        jury: row.jury_quote,
        type: row.gallery_type,
        createdAt: row.$createdAt,
        moderationReason: row.moderation_reason ?? '',
        consentVersion: row.consent_version ?? null,
        consentedAt: row.consented_at ?? null,
        storagePath: row.storage_path ?? '',
      })),
      total: result.total,
    });
  } catch (error) {
    logServerError('api.gallery.moderation.GET', error);
    return NextResponse.json({ error: 'Moderation queue unavailable.' }, { status: 500 });
  }
}

/**
 * Moderator decision on a pending submission. Only `pending` rows can be decided, so a
 * revoked (archived) post can never be re-published by a moderator. Rejected rows keep their
 * metadata as evidence; the stored image is removed.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Body is not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const action = body.action;
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim().substring(0, MAX_NOTE_LENGTH) : '';

    const auth = await requireModerator(request, typeof action === 'string' ? action : 'UNKNOWN');
    if (!auth.isAllowed) return auth.response;

    if (!submissionId || (action !== 'APPROVE' && action !== 'REJECT')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const moderatorAction: ModeratorAction = action;

    await ensureCoreAppwriteResources();

    const tables = getAdminTables();
    const row = await tables.getRow<GalleryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_GALLERY_ID,
      rowId: submissionId,
    });

    if (row.status !== 'pending') {
      logServerInfo('api.gallery.moderation.audit', {
        actorId: auth.user.id,
        action: moderatorAction,
        submissionId,
        fromStatus: row.status,
        result: 'invalid_status',
      });
      return NextResponse.json({ error: 'Only pending submissions can be moderated.', code: 'INVALID_GALLERY_STATUS' }, {
        status: 409,
      });
    }

    const moderatedAt = new Date().toISOString();
    const updated = await tables.updateRow<GalleryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_GALLERY_ID,
      rowId: submissionId,
      data: {
        status: moderatorAction === 'APPROVE' ? 'approved' : 'rejected',
        moderated_by: auth.user.id,
        moderated_at: moderatedAt,
        ...(note ? { moderation_reason: note } : {}),
      },
    });

    if (moderatorAction === 'REJECT') {
      await cleanupGalleryUpload(row.storage_path, 'moderator_rejected', 'api.gallery.moderation');
    }

    logServerInfo('api.gallery.moderation.audit', {
      actorId: auth.user.id,
      action: moderatorAction,
      submissionId,
      ownerId: row.user_id,
      fromStatus: row.status,
      toStatus: updated.status,
      moderatedAt,
      result: 'applied',
    });

    return NextResponse.json({ id: updated.$id, status: updated.status });
  } catch (error) {
    logServerError('api.gallery.moderation.POST', error);
    return NextResponse.json({ error: 'Moderation update failed.' }, { status: 500 });
  }
}
