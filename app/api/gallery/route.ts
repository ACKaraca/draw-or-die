import { NextResponse, type NextRequest } from 'next/server';
import { ID, Query } from 'node-appwrite';

import {
  APPWRITE_BUCKET_GALLERY_ID,
  APPWRITE_DATABASE_ID,
  APPWRITE_SERVER_ENDPOINT,
  APPWRITE_SERVER_PROJECT_ID,
  APPWRITE_TABLE_GALLERY_ID,
  getAdminStorage,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError, logServerInfo } from '@/lib/logger';
import { normalizeCritiqueText } from '@/lib/critique';
import { clampAspectRatio, deriveAspectRatio } from '@/lib/aspect-ratio';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { validateGalleryConsent } from '@/lib/gallery-consent';
import {
  decidePublication,
  detectPromptInjection,
  findClientApprovalFields,
  isPubliclyVisibleGalleryRow,
} from '@/lib/gallery-moderation-policy';
import { requestModerationVerdict } from '@/lib/gallery-moderation-provider';
import { cleanupGalleryUpload } from '@/lib/gallery-storage-cleanup';
import { hasAllowedImageSignature, type GalleryRow, type GalleryRowStatus } from '@/lib/gallery-rows';
import type { GalleryType } from '@/types';

const MAX_PAGE_SIZE = 100;
const MAX_STORAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_GALLERY_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_GALLERY_STATUSES = new Set(['approved', 'pending', 'archived', 'rejected']);
const ARCHIVABLE_STATUSES: ReadonlySet<GalleryRowStatus> = new Set(['approved', 'pending']);

function sanitizeEnv(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== 'string') return '';

  const value = raw.trim();
  if (!value) return '';

  return /[\r\n\0]/.test(value) ? '' : value;
}

const APPWRITE_PUBLIC_ENDPOINT = sanitizeEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT') || APPWRITE_SERVER_ENDPOINT;
const APPWRITE_PUBLIC_PROJECT_ID = sanitizeEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID') || APPWRITE_SERVER_PROJECT_ID;

function buildPreviewFileUrl(fileId: string): string {
  const endpoint = APPWRITE_PUBLIC_ENDPOINT.replace(/\/$/, '');
  const project = encodeURIComponent(APPWRITE_PUBLIC_PROJECT_ID);
  const safeFileId = encodeURIComponent(fileId.trim());
  return `${endpoint}/storage/buckets/${APPWRITE_BUCKET_GALLERY_ID}/files/${safeFileId}/preview?project=${project}&width=1400&height=1400&quality=76&output=webp`;
}

function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/\/files\/([^/]+)\//i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function toGalleryImageUrl(row: GalleryRow): string {
  if (row.public_url) {
    const fromPublic = extractFileIdFromUrl(row.public_url);
    if (fromPublic) return buildPreviewFileUrl(fromPublic);
  }

  if (row.storage_path) {
    return buildPreviewFileUrl(row.storage_path);
  }

  if (row.public_url) {
    return row.public_url;
  }

  return `https://picsum.photos/seed/${row.$id}/600/800`;
}

function toGalleryItem(row: GalleryRow, currentUserId?: string) {
  return {
    id: row.$id,
    img: toGalleryImageUrl(row),
    title: row.title,
    jury: normalizeCritiqueText(row.jury_quote) || row.jury_quote,
    type: row.gallery_type,
    status: row.status,
    analysisKind: row.analysis_kind ?? 'SINGLE_JURY',
    aspectRatio: clampAspectRatio((row.aspect_ratio_milli ?? 750) / 1000),
    isOwner: Boolean(currentUserId && row.user_id === currentUserId),
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureCoreAppwriteResources();

    const params = request.nextUrl.searchParams;
    const limitRaw = Number(params.get('limit') ?? '15');
    const offsetRaw = Number(params.get('offset') ?? '0');
    const type = params.get('type');
    const mine = params.get('mine') === '1' || params.get('mine') === 'true';
    const requestedStatus = params.get('status');

    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(MAX_PAGE_SIZE, limitRaw)) : 15;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const queries = [
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset),
    ];

    let currentUserId: string | undefined;

    if (mine) {
      const user = await getAuthenticatedUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Kişisel galeri için giriş yapmanız gerekiyor.' }, { status: 401 });
      }
      currentUserId = user.id;
      queries.push(Query.equal('user_id', user.id));

      if (requestedStatus && ALLOWED_GALLERY_STATUSES.has(requestedStatus)) {
        queries.push(Query.equal('status', requestedStatus));
      }
    } else {
      queries.push(Query.equal('status', 'approved'));
    }

    if (type === 'HALL_OF_FAME' || type === 'WALL_OF_DEATH' || type === 'COMMUNITY') {
      queries.push(Query.equal('gallery_type', type));
    }

    const tables = getAdminTables();
    const result = await tables.listRows<GalleryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_GALLERY_ID,
      queries,
      total: true,
    });

    // Defense in depth: the public feed never returns a row that is not approved or was revoked,
    // even if a query filter regresses.
    const visibleRows = mine ? result.rows : result.rows.filter(isPubliclyVisibleGalleryRow);
    const items = visibleRows.map((row) => toGalleryItem(row, currentUserId));

    return NextResponse.json({
      items,
      total: result.total,
    });
  } catch (error) {
    logServerError('api.gallery.GET', error);
    return NextResponse.json({ error: 'Galeri yüklenemedi.' }, { status: 500 });
  }
}

function jsonError(error: string, code: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, code, ...(extra ?? {}) }, { status });
}

function isGalleryType(value: unknown): value is GalleryType {
  return value === 'HALL_OF_FAME' || value === 'WALL_OF_DEATH' || value === 'COMMUNITY';
}

/**
 * Publish = the explicit user action. Order is deliberate: auth → durable owner → consent →
 * validation → moderation → storage → row. Nothing is written before consent is verified,
 * and a moderation rejection never reaches storage.
 */
export async function POST(request: NextRequest) {
  let uploadedFileId = '';

  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const lang = getRequestLanguage(request);

    // Guests have no durable identity to manage or revoke a public post later.
    if (!user.email) {
      return jsonError(
        pickLocalized(
          lang,
          'Misafir hesaplar galeride paylaşım yapamaz. Paylaşmak için hesap oluştur.',
          'Guest accounts cannot publish to the gallery. Create an account to share.',
        ),
        'GUEST_PUBLISH_BLOCKED',
        403,
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Body is not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonError(
        pickLocalized(lang, 'Geçersiz galeri verisi.', 'Invalid gallery payload.'),
        'INVALID_GALLERY_PAYLOAD',
        400,
      );
    }

    // Approval is server-owned; anything the client says about it is ignored (and observable).
    const ignoredClientApprovalFields = findClientApprovalFields(body);

    const title = (typeof body.title === 'string' ? body.title : '').trim().substring(0, 255);
    const juryQuote = normalizeCritiqueText(typeof body.juryQuote === 'string' ? body.juryQuote : '').substring(0, 8000);
    const galleryType = body.galleryType;
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/png';
    const analysisKind = typeof body.analysisKind === 'string' && body.analysisKind.trim()
      ? body.analysisKind.trim().substring(0, 64)
      : 'COMMUNITY_UPLOAD';
    const previewWidth = Number.isFinite(body.previewWidth) ? Math.max(1, Math.floor(Number(body.previewWidth))) : null;
    const previewHeight = Number.isFinite(body.previewHeight)
      ? Math.max(1, Math.floor(Number(body.previewHeight)))
      : null;
    const aspectRatio = Number.isFinite(body.aspectRatio)
      ? clampAspectRatio(Number(body.aspectRatio))
      : deriveAspectRatio(previewWidth, previewHeight);
    const aspectRatioMilli = Math.round(aspectRatio * 1000);

    if (!title || !juryQuote || !isGalleryType(galleryType)) {
      return jsonError(
        pickLocalized(lang, 'Geçersiz galeri verisi.', 'Invalid gallery payload.'),
        'INVALID_GALLERY_PAYLOAD',
        400,
      );
    }

    const consentCheck = validateGalleryConsent(body.consent, galleryType);
    if (!consentCheck.isValid) {
      logServerInfo('api.gallery.publish.consent_rejected', { userId: user.id, galleryType, code: consentCheck.code });
      return jsonError(
        consentCheck.code === 'GALLERY_CONSENT_VERSION_MISMATCH'
          ? pickLocalized(
            lang,
            'Paylaşım koşulları güncellendi. Sayfayı yenileyip tekrar onayla.',
            'Sharing terms were updated. Refresh the page and confirm again.',
          )
          : pickLocalized(
            lang,
            'Galeride yayınlamak için açık onayın gerekiyor.',
            'Explicit consent is required to publish to the gallery.',
          ),
        consentCheck.code,
        consentCheck.code === 'GALLERY_CONSENT_VERSION_MISMATCH' ? 409 : 400,
      );
    }

    if (galleryType === 'COMMUNITY' && !imageBase64) {
      return jsonError(
        pickLocalized(lang, 'Community paylaşımı için pafta veya görsel zorunlu.', 'A board or image is required for community shares.'),
        'COMMUNITY_IMAGE_REQUIRED',
        400,
      );
    }

    let imageBuffer: Buffer | null = null;
    let imageBase64Part = '';

    if (imageBase64) {
      if (!ALLOWED_GALLERY_MIME_TYPES.has(mimeType)) {
        return jsonError(
          pickLocalized(
            lang,
            'Geçersiz görsel formatı. Sadece JPG/PNG/WEBP kabul edilir.',
            'Invalid image format. Only JPG/PNG/WEBP are accepted.',
          ),
          'UNSUPPORTED_IMAGE_TYPE',
          415,
        );
      }

      imageBase64Part = imageBase64.includes(',') ? (imageBase64.split(',')[1] ?? '') : imageBase64;
      imageBuffer = imageBase64Part ? Buffer.from(imageBase64Part, 'base64') : null;
      if (!imageBuffer?.length || !hasAllowedImageSignature(imageBuffer, mimeType)) {
        return jsonError(
          pickLocalized(lang, 'Görsel verisi bozuk.', 'Image data is malformed.'),
          'INVALID_IMAGE_PAYLOAD',
          400,
        );
      }

      if (imageBuffer.byteLength > MAX_STORAGE_UPLOAD_BYTES) {
        return jsonError(
          pickLocalized(
            lang,
            'Galeri görseli 5MB sınırını aşıyor. Lütfen daha düşük çözünürlükte tekrar deneyin.',
            'Gallery image exceeds the 5MB limit. Please retry at a lower resolution.',
          ),
          'GALLERY_IMAGE_TOO_LARGE',
          413,
        );
      }
    }

    await ensureCoreAppwriteResources();

    const isInjectionSuspected = detectPromptInjection(title, juryQuote);
    const verdict = await requestModerationVerdict({
      surface: 'a public architecture board gallery (Hall of Fame, Wall of Death, Community)',
      guidance: 'Do not reject ordinary architecture drawings, plans, renders, or harsh-but-civil critique text.',
      image: imageBuffer ? { base64: imageBase64Part, mimeType } : undefined,
      untrustedText: `Title: ${title}\nText: ${juryQuote}`,
      logScope: 'api.gallery.moderation',
    });
    const decision = decidePublication(verdict, { isInjectionSuspected });

    if (decision === 'rejected') {
      logServerInfo('api.gallery.publish', {
        userId: user.id,
        galleryType,
        decision,
        verdict: verdict.kind,
        ignoredClientApprovalFields,
      });
      return jsonError(
        verdict.reason,
        galleryType === 'COMMUNITY' ? 'COMMUNITY_MODERATION_REJECTED' : 'GALLERY_MODERATION_REJECTED',
        422,
        {
          moderationReason: verdict.reason,
          moderationCategory: verdict.kind === 'rejected' ? verdict.category : 'REJECT',
        },
      );
    }

    let storagePath = '';
    let publicUrl = '';

    if (imageBuffer) {
      const ext = mimeType.split('/')[1] || 'png';
      const fileId = ID.unique();
      const file = new File([new Uint8Array(imageBuffer)], `${fileId}.${ext}`, { type: mimeType });

      await getAdminStorage().createFile({
        bucketId: APPWRITE_BUCKET_GALLERY_ID,
        fileId,
        file,
      });

      uploadedFileId = fileId;
      storagePath = fileId;
      publicUrl = buildPreviewFileUrl(fileId);
    }

    const status: GalleryRowStatus = decision;
    const isPendingReview = status === 'pending';
    const tables = getAdminTables();
    const created = await tables.createRow<GalleryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_GALLERY_ID,
      rowId: ID.unique(),
      data: {
        user_id: user.id,
        title,
        jury_quote: juryQuote,
        gallery_type: galleryType,
        status,
        analysis_kind: analysisKind,
        aspect_ratio_milli: aspectRatioMilli,
        source_mime: mimeType,
        moderation_reason: verdict.reason.substring(0, 500),
        public_url: publicUrl,
        storage_path: storagePath,
        consent_scope: consentCheck.consent.scope,
        consent_version: consentCheck.consent.version,
        consented_at: consentCheck.consent.consentedAt,
        ...(previewWidth ? { preview_width: previewWidth } : {}),
        ...(previewHeight ? { preview_height: previewHeight } : {}),
      },
    });
    uploadedFileId = '';

    logServerInfo('api.gallery.publish', {
      submissionId: created.$id,
      userId: user.id,
      galleryType,
      decision: status,
      verdict: verdict.kind,
      pendingCause: verdict.kind === 'pending' ? verdict.cause : null,
      isInjectionSuspected,
      consentVersion: consentCheck.consent.version,
      ignoredClientApprovalFields,
    });

    return NextResponse.json({
      item: toGalleryItem(created, user.id),
      submissionId: created.$id,
      moderationPendingReview: isPendingReview,
      ...(isPendingReview
        ? { code: galleryType === 'COMMUNITY' ? 'COMMUNITY_PENDING_REVIEW' : 'GALLERY_PENDING_REVIEW' }
        : {}),
    });
  } catch (error) {
    await cleanupGalleryUpload(uploadedFileId, 'row_write_failed', 'api.gallery');
    logServerError('api.gallery.POST', error);
    return NextResponse.json(
      {
        error: 'Galeriye ekleme başarısız.',
        code: 'GALLERY_WRITE_FAILED',
      },
      { status: 500 },
    );
  }
}

/**
 * Owner-only visibility management.
 * - ARCHIVE revokes consent: removes an approved or pending post from (future) public view.
 * - RESHARE needs fresh consent and restores the pre-revoke moderation state. It can never
 *   upgrade a post to `approved` that was not already moderator/model-approved before.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json({ error: 'Misafir hesaplar galeri görünürlüğünü yönetemez.' }, { status: 403 });
    }

    const lang = getRequestLanguage(request);

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Body is not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Geçersiz galeri güncelleme isteği.' }, { status: 400 });
    }

    const submissionId = (typeof body.submissionId === 'string' ? body.submissionId : '').trim();
    const action = body.action;

    if (!submissionId || (action !== 'ARCHIVE' && action !== 'RESHARE')) {
      return NextResponse.json({ error: 'Geçersiz galeri güncelleme isteği.' }, { status: 400 });
    }

    await ensureCoreAppwriteResources();

    const tables = getAdminTables();
    const row = await tables.getRow<GalleryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_GALLERY_ID,
      rowId: submissionId,
    });

    if (row.user_id !== user.id) {
      logServerInfo('api.gallery.manage.forbidden', { submissionId, userId: user.id, action });
      return NextResponse.json({ error: 'Bu galeriyi yönetme yetkiniz yok.' }, { status: 403 });
    }

    const isAllowedTransition = action === 'ARCHIVE'
      ? ARCHIVABLE_STATUSES.has(row.status)
      : row.status === 'archived';
    if (!isAllowedTransition) {
      return NextResponse.json(
        {
          error: action === 'ARCHIVE'
            ? pickLocalized(
              lang,
              'Yalnızca yayındaki veya incelemedeki paylaşımlar kaldırılabilir.',
              'Only published or in-review shares can be archived.',
            )
            : pickLocalized(
              lang,
              'Yalnızca kaldırdığın paylaşımlar yeniden paylaşılabilir.',
              'Only shares you archived can be reshared.',
            ),
          code: 'INVALID_GALLERY_STATUS',
        },
        { status: 409 },
      );
    }

    let data: Partial<GalleryRow>;
    if (action === 'ARCHIVE') {
      data = {
        status: 'archived',
        revoked_at: new Date().toISOString(),
        archived_from_status: row.status,
      };
    } else {
      const consentCheck = validateGalleryConsent(body.consent, row.gallery_type);
      if (!consentCheck.isValid) {
        return NextResponse.json(
          {
            error: pickLocalized(
              lang,
              'Yeniden yayınlamak için açık onayın gerekiyor.',
              'Explicit consent is required to publish again.',
            ),
            code: consentCheck.code,
          },
          { status: consentCheck.code === 'GALLERY_CONSENT_VERSION_MISMATCH' ? 409 : 400 },
        );
      }

      // Rows archived before this field existed have unknown provenance → fail pending.
      data = {
        status: row.archived_from_status === 'approved' ? 'approved' : 'pending',
        revoked_at: null,
        archived_from_status: null,
        consent_scope: consentCheck.consent.scope,
        consent_version: consentCheck.consent.version,
        consented_at: consentCheck.consent.consentedAt,
      };
    }

    const updated = await tables.updateRow<GalleryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_GALLERY_ID,
      rowId: submissionId,
      data,
    });

    logServerInfo('api.gallery.manage', {
      submissionId,
      userId: user.id,
      action,
      fromStatus: row.status,
      toStatus: updated.status,
    });

    return NextResponse.json({
      item: toGalleryItem(updated, user.id),
    });
  } catch (error) {
    logServerError('api.gallery.PATCH', error);
    return NextResponse.json({ error: 'Galeri güncellenemedi.' }, { status: 500 });
  }
}
