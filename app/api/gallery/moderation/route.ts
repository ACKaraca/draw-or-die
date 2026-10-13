import { NextResponse, type NextRequest } from 'next/server';
import { Query } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_CONFESSIONS_ID,
  APPWRITE_TABLE_GALLERY_ID,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  isGalleryModerator,
  type AppwriteAuthUser,
  type ConfessionRow,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError, logServerInfo } from '@/lib/logger';
import { cleanupGalleryUpload } from '@/lib/gallery-storage-cleanup';
import { buildPreviewFileUrl, extractFileIdFromUrl, type GalleryRow } from '@/lib/gallery-rows';

const MAX_QUEUE_SIZE = 100;
const MAX_NOTE_LENGTH = 500;
const AUDIT_SCOPE = 'api.gallery.moderation.audit';

type ModeratorAction = 'APPROVE' | 'REJECT';
type QueueKind = 'gallery' | 'confession';

type ModeratorCheck =
  | { isAllowed: true; user: AppwriteAuthUser }
  | { isAllowed: false; response: NextResponse };

/** Non-moderators get the same 404 as an unknown route so the endpoint's existence is not revealed. */
async function requireModerator(request: NextRequest, action: string): Promise<ModeratorCheck> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !isGalleryModerator(user)) {
    logServerInfo(AUDIT_SCOPE, {
      actorId: user?.id ?? null,
      action,
      result: user ? 'forbidden' : 'unauthenticated',
    });
    return { isAllowed: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  return { isAllowed: true, user };
}

/** Moderator review queue: pending gallery submissions and pending confessions, oldest first. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireModerator(request, 'LIST_QUEUE');
    if (!auth.isAllowed) return auth.response;

    await ensureCoreAppwriteResources();

    const tables = getAdminTables();
    const pendingQueries = [Query.equal('status', 'pending'), Query.orderAsc('$createdAt'), Query.limit(MAX_QUEUE_SIZE)];
    const [gallery, confessions] = await Promise.all([
      tables.listRows<GalleryRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_GALLERY_ID,
        queries: pendingQueries,
        total: true,
      }),
      tables.listRows<ConfessionRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_CONFESSIONS_ID,
        queries: pendingQueries,
        total: true,
      }),
    ]);

    return NextResponse.json({
      items: gallery.rows.map((row) => ({
        id: row.$id,
        title: row.title,
        jury: row.jury_quote,
        type: row.gallery_type,
        createdAt: row.$createdAt,
        moderationReason: row.moderation_reason ?? '',
        consentVersion: row.consent_version ?? null,
        consentedAt: row.consented_at ?? null,
        storagePath: row.storage_path ?? '',
        imageUrl: row.storage_path ? buildPreviewFileUrl(row.storage_path) : null,
      })),
      total: gallery.total,
      confessions: confessions.rows.map((row) => ({
        id: row.$id,
        text: row.text,
        createdAt: row.$createdAt,
        moderationReason: row.moderation_reason ?? '',
        imageUrl: row.image_url || null,
      })),
      confessionsTotal: confessions.total,
    });
  } catch (error) {
    logServerError('api.gallery.moderation.GET', error);
    return NextResponse.json({ error: 'Moderation queue unavailable.' }, { status: 500 });
  }
}

/**
 * Moderator decision on a pending gallery submission (`kind: "gallery"`, default) or confession
 * (`kind: "confession"`). Only `pending` rows can be decided, so a revoked (archived) post can never
 * be re-published by a moderator. Rejected rows keep their metadata as evidence; the stored image is removed.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireModerator(request, 'DECIDE');
    if (!auth.isAllowed) return auth.response;

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Body is not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const action = body.action;
    const kind = body.kind ?? 'gallery';
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim().substring(0, MAX_NOTE_LENGTH) : '';

    if (!submissionId || (action !== 'APPROVE' && action !== 'REJECT') || (kind !== 'gallery' && kind !== 'confession')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const moderatorAction: ModeratorAction = action;
    const queueKind: QueueKind = kind;
    const tableId = queueKind === 'gallery' ? APPWRITE_TABLE_GALLERY_ID : APPWRITE_TABLE_CONFESSIONS_ID;

    await ensureCoreAppwriteResources();

    const tables = getAdminTables();
    const row = await tables.getRow<GalleryRow | ConfessionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId,
      rowId: submissionId,
    });

    if (row.status !== 'pending') {
      logServerInfo(AUDIT_SCOPE, {
        actorId: auth.user.id,
        action: moderatorAction,
        kind: queueKind,
        submissionId,
        fromStatus: row.status,
        result: 'invalid_status',
      });
      return NextResponse.json({ error: 'Only pending submissions can be moderated.', code: 'INVALID_GALLERY_STATUS' }, {
        status: 409,
      });
    }

    const moderatedAt = new Date().toISOString();
    const status: 'approved' | 'rejected' = moderatorAction === 'APPROVE' ? 'approved' : 'rejected';
    // Confessions have no moderated_by/moderated_at columns; the audit log carries the actor instead.
    const data = queueKind === 'gallery'
      ? { status, moderated_by: auth.user.id, moderated_at: moderatedAt, ...(note ? { moderation_reason: note } : {}) }
      : { status, ...(note ? { moderation_reason: note } : {}) };
    const updated = await tables.updateRow<GalleryRow | ConfessionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId,
      rowId: submissionId,
      data,
    });

    if (moderatorAction === 'REJECT') {
      const fileId = queueKind === 'gallery'
        ? (row as GalleryRow).storage_path
        : extractFileIdFromUrl((row as ConfessionRow).image_url ?? '');
      await cleanupGalleryUpload(fileId, 'moderator_rejected', 'api.gallery.moderation');
    }

    logServerInfo(AUDIT_SCOPE, {
      actorId: auth.user.id,
      action: moderatorAction,
      kind: queueKind,
      submissionId,
      ownerId: queueKind === 'gallery' ? (row as GalleryRow).user_id : null,
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
