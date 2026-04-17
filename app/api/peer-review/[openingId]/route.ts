import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PEER_REVIEWS_ID,
  APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
  PeerReviewOpeningRow,
  PeerReviewRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  updateProfileById,
} from '@/lib/appwrite/server';
import { RAPIDO_REWARDS } from '@/lib/pricing';
import { toRapidoCents, splitRapidoCents, toRapidoDisplay, rapidoUnitsToCents } from '@/lib/rapido-cents';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';

type RouteContext = { params: Promise<{ openingId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const lang = getRequestLanguage(request);
  const { openingId } = await context.params;

  try {
    await ensureCoreAppwriteResources();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'), code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    const tables = getAdminTables();

    let openingRow: PeerReviewOpeningRow;
    try {
      openingRow = await tables.getRow<PeerReviewOpeningRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
        rowId: openingId,
      });
    } catch {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Açılış bulunamadı.', 'Opening not found.'),
          code: 'OPENING_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    const reviewsResult = await tables.listRows<PeerReviewRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PEER_REVIEWS_ID,
      queries: [
        Query.equal('opening_id', openingId),
        Query.orderDesc('created_at'),
        Query.limit(100),
      ],
    });

    return NextResponse.json({
      opening: {
        id: openingRow.$id,
        submissionId: openingRow.submission_id,
        ownerUserId: openingRow.owner_user_id,
        status: openingRow.status,
        reviewCount: openingRow.review_count,
        maxReviews: openingRow.max_reviews,
        openedAt: openingRow.opened_at,
      },
      reviews: reviewsResult.rows.map((r) => ({
        id: r.$id,
        reviewerDisplay: r.reviewer_display,
        body: r.body,
        rating: r.rating ?? null,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    logServerError('peer-review:get', error);
    return NextResponse.json(
      {
        error: pickLocalized(lang, 'Sunucu hatası oluştu.', 'An internal server error occurred.'),
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const lang = getRequestLanguage(request);
  const { openingId } = await context.params;

  try {
    await ensureCoreAppwriteResources();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'), code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    // Anonymous users cannot comment
    if (!user.email || !user.email.trim()) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'Yorum bırakmak için kayıtlı bir hesap gereklidir.',
            'A registered account is required to leave a review.',
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

    const payload = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const reviewBody = typeof payload.body === 'string' ? payload.body : '';
    const rating =
      payload.rating !== undefined && payload.rating !== null
        ? Number(payload.rating)
        : undefined;

    if (reviewBody.length < 10 || reviewBody.length > 1000) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'Yorum 10 ile 1000 karakter arasında olmalıdır.',
            'Review body must be between 10 and 1000 characters.',
          ),
          code: 'INVALID_BODY_LENGTH',
        },
        { status: 400 },
      );
    }

    if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Puan 1 ile 5 arasında olmalıdır.', 'Rating must be between 1 and 5.'),
          code: 'INVALID_RATING',
        },
        { status: 400 },
      );
    }

    const tables = getAdminTables();

    // Fetch the opening
    let openingRow: PeerReviewOpeningRow;
    try {
      openingRow = await tables.getRow<PeerReviewOpeningRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
        rowId: openingId,
      });
    } catch {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Açılış bulunamadı.', 'Opening not found.'),
          code: 'OPENING_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    if (openingRow.status !== 'open') {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Bu değerlendirme artık açık değil.', 'This peer review is no longer open.'),
          code: 'OPENING_CLOSED',
        },
        { status: 409 },
      );
    }

    // User cannot comment on their own opening
    if (openingRow.owner_user_id === user.id) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'Kendi projenize yorum bırakamazsınız.',
            'You cannot review your own submission.',
          ),
          code: 'SELF_REVIEW_NOT_ALLOWED',
        },
        { status: 403 },
      );
    }

    // Check if user has already commented on this opening
    const existingReview = await tables.listRows<PeerReviewRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PEER_REVIEWS_ID,
      queries: [
        Query.equal('opening_id', openingId),
        Query.equal('reviewer_user_id', user.id),
        Query.limit(1),
      ],
    });

    if (existingReview.rows.length > 0) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'Bu projeye zaten yorum bıraktınız.',
            'You have already reviewed this submission.',
          ),
          code: 'ALREADY_REVIEWED',
        },
        { status: 409 },
      );
    }

    // Build reviewer display name: "Mimar #" + last 4 chars of user id
    const reviewerDisplay = `Mimar #${user.id.slice(-4)}`;
    const createdAt = new Date().toISOString();

    const reviewData: Record<string, unknown> = {
      opening_id: openingId,
      submission_id: openingRow.submission_id,
      reviewer_user_id: user.id,
      reviewer_display: reviewerDisplay,
      body: reviewBody,
      created_at: createdAt,
    };

    if (rating !== undefined) {
      reviewData.rating = rating;
    }

    // Use DefaultRow generic so the data param accepts Record<string,unknown>
    const newReview = await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PEER_REVIEWS_ID,
      rowId: ID.unique(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: reviewData as any,
    }) as PeerReviewRow;

    // Increment review_count on the opening
    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
      rowId: openingId,
      data: { review_count: openingRow.review_count + 1 },
    });

    // Reward the reviewer with +0.25 rapido
    const rewardCents = rapidoUnitsToCents(RAPIDO_REWARDS.PEER_REVIEW_COMMENT);
    const reviewerProfile = await getOrCreateProfile(user);
    const currentCents = toRapidoCents(reviewerProfile.rapido_pens, reviewerProfile.rapido_fraction_cents);
    const newCents = currentCents + rewardCents;
    const { rapidoPens, rapidoFractionCents } = splitRapidoCents(newCents);

    await updateProfileById(user.id, {
      rapido_pens: rapidoPens,
      rapido_fraction_cents: rapidoFractionCents,
    });

    return NextResponse.json({
      review: {
        id: newReview.$id,
        reviewerDisplay: newReview.reviewer_display,
        body: newReview.body,
        rating: newReview.rating ?? null,
        createdAt: newReview.created_at,
      },
      rapido_earned: RAPIDO_REWARDS.PEER_REVIEW_COMMENT,
    });
  } catch (error) {
    logServerError('peer-review:comment', error);
    return NextResponse.json(
      {
        error: pickLocalized(lang, 'Sunucu hatası oluştu.', 'An internal server error occurred.'),
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
