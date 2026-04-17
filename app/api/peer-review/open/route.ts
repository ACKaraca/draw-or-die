import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import type { Models } from 'node-appwrite';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_GALLERY_ID,
  APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
  PeerReviewOpeningRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  updateProfileById,
} from '@/lib/appwrite/server';
import { RAPIDO_COSTS } from '@/lib/pricing';
import { toRapidoCents, splitRapidoCents, toRapidoDisplay, rapidoUnitsToCents } from '@/lib/rapido-cents';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const lang = getRequestLanguage(request);

  try {
    await ensureCoreAppwriteResources();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'), code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    // Anonymous users (no email) cannot open a peer review
    if (!user.email || !user.email.trim()) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'Akran değerlendirmesi açmak için kayıtlı bir hesap gereklidir.',
            'A registered account is required to open a peer review.',
          ),
          code: 'ANONYMOUS_NOT_ALLOWED',
        },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Geçersiz istek gövdesi.', 'Invalid request body.'), code: 'INVALID_BODY' },
        { status: 400 },
      );
    }

    const submissionId =
      body !== null && typeof body === 'object' && 'submissionId' in body
        ? (body as Record<string, unknown>).submissionId
        : undefined;

    if (typeof submissionId !== 'string' || !submissionId.trim()) {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'submissionId zorunludur.', 'submissionId is required.'),
          code: 'MISSING_SUBMISSION_ID',
        },
        { status: 400 },
      );
    }

    const tables = getAdminTables();

    // Verify submission exists and belongs to the authenticated user
    type MinGalleryRow = Models.Row & { user_id: string };
    let galleryRow: MinGalleryRow;
    try {
      galleryRow = await tables.getRow<MinGalleryRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_GALLERY_ID,
        rowId: submissionId.trim(),
      });
    } catch {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Pafta bulunamadı.', 'Submission not found.'),
          code: 'SUBMISSION_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    if (galleryRow.user_id !== user.id) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'Bu pafta size ait değil.',
            'This submission does not belong to you.',
          ),
          code: 'SUBMISSION_NOT_OWNED',
        },
        { status: 403 },
      );
    }

    // Check for idempotency: return existing open opening if present
    const existing = await tables.listRows<PeerReviewOpeningRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
      queries: [
        Query.equal('submission_id', submissionId.trim()),
        Query.equal('status', 'open'),
        Query.limit(1),
      ],
    });

    if (existing.rows.length > 0) {
      const openingRow = existing.rows[0];
      const profile = await getOrCreateProfile(user);
      const remainingCents = toRapidoCents(profile.rapido_pens, profile.rapido_fraction_cents);

      return NextResponse.json({
        opening: {
          id: openingRow.$id,
          submissionId: openingRow.submission_id,
          status: openingRow.status,
          reviewCount: openingRow.review_count,
          maxReviews: openingRow.max_reviews,
          openedAt: openingRow.opened_at,
        },
        rapido_remaining: toRapidoDisplay(remainingCents),
      });
    }

    // Deduct cost from the owner's rapido balance
    const profile = await getOrCreateProfile(user);
    const costCents = rapidoUnitsToCents(RAPIDO_COSTS.PEER_REVIEW_OPEN);
    const currentCents = toRapidoCents(profile.rapido_pens, profile.rapido_fraction_cents);

    if (currentCents < costCents) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            `Yeterli rapido yok. Gerekli: ${RAPIDO_COSTS.PEER_REVIEW_OPEN} rapido.`,
            `Insufficient rapido. Required: ${RAPIDO_COSTS.PEER_REVIEW_OPEN} rapido.`,
          ),
          code: 'INSUFFICIENT_RAPIDO',
        },
        { status: 402 },
      );
    }

    const newCents = currentCents - costCents;
    const { rapidoPens, rapidoFractionCents } = splitRapidoCents(newCents);

    await updateProfileById(user.id, {
      rapido_pens: rapidoPens,
      rapido_fraction_cents: rapidoFractionCents,
    });

    // Create the opening row
    const openedAt = new Date().toISOString();
    const opening = await tables.createRow<PeerReviewOpeningRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
      rowId: ID.unique(),
      data: {
        submission_id: submissionId.trim(),
        owner_user_id: user.id,
        opened_at: openedAt,
        review_count: 0,
        max_reviews: 20,
        status: 'open',
      },
    });

    return NextResponse.json({
      opening: {
        id: opening.$id,
        submissionId: opening.submission_id,
        status: opening.status,
        reviewCount: opening.review_count,
        maxReviews: opening.max_reviews,
        openedAt: opening.opened_at,
      },
      rapido_remaining: toRapidoDisplay(newCents),
    });
  } catch (error) {
    logServerError('peer-review:open', error);
    return NextResponse.json(
      {
        error: pickLocalized(lang, 'Sunucu hatası oluştu.', 'An internal server error occurred.'),
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
