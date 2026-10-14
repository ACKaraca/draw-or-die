import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import type { Models } from 'node-appwrite';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_GALLERY_ID,
  APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
  PeerReviewOpeningRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';
import { rejectIfHeld } from '@/lib/p0-holds';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
// Appwrite accepts at most 100 values in a single Query.equal.
const GALLERY_LOOKUP_CHUNK_SIZE = 100;

type GalleryRow = Models.Row & {
  user_id: string;
  title: string;
  jury_quote: string;
  gallery_type: string;
  status: string;
  public_url?: string;
};

export async function GET(request: NextRequest) {
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

    // P0 hold: the list delivers other users' gallery records, which carry no consent marker yet.
    const heldResponse = await rejectIfHeld('gallery_public', lang);
    if (heldResponse) return heldResponse;

    const { searchParams } = new URL(request.url);
    const pageRaw = Number(searchParams.get('page') ?? '1');
    const limitRaw = Number(searchParams.get('limit') ?? String(DEFAULT_LIMIT));

    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(Math.floor(limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = (page - 1) * limit;

    const tables = getAdminTables();

    // List open peer review openings, newest first
    const openingsResult = await tables.listRows<PeerReviewOpeningRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
      queries: [
        Query.equal('status', 'open'),
        Query.orderDesc('opened_at'),
        Query.limit(limit),
        Query.offset(offset),
      ],
      total: true,
    });

    const openingRows = openingsResult.rows;

    if (openingRows.length === 0) {
      return NextResponse.json({ openings: [], total: openingsResult.total ?? 0 });
    }

    // Collect unique submission IDs and fetch their gallery rows in batched list queries
    const submissionIds = [...new Set(openingRows.map((o) => o.submission_id).filter(Boolean))];
    const idChunks: string[][] = [];
    for (let i = 0; i < submissionIds.length; i += GALLERY_LOOKUP_CHUNK_SIZE) {
      idChunks.push(submissionIds.slice(i, i + GALLERY_LOOKUP_CHUNK_SIZE));
    }

    const galleryResults = await Promise.allSettled(
      idChunks.map((ids) =>
        tables.listRows<GalleryRow>({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_GALLERY_ID,
          queries: [
            Query.equal('$id', ids),
            Query.select(['$id', 'title', 'jury_quote', 'public_url']),
            Query.limit(ids.length),
          ],
        }),
      ),
    );

    const galleryMap = new Map<string, GalleryRow>();
    for (const result of galleryResults) {
      if (result.status === 'fulfilled') {
        for (const row of result.value.rows) {
          galleryMap.set(row.$id, row);
        }
      } else {
        logServerError('peer-review:list:gallery-lookup', result.reason);
      }
    }

    const openings = openingRows.map((opening) => {
      const gallery = galleryMap.get(opening.submission_id);
      return {
        id: opening.$id,
        submissionId: opening.submission_id,
        title: gallery?.title ?? '',
        juryQuote: gallery?.jury_quote ?? '',
        publicUrl: gallery?.public_url ?? null,
        ownerDisplay: `Mimar #${opening.owner_user_id.slice(-4)}`,
        reviewCount: opening.review_count,
        maxReviews: opening.max_reviews,
        openedAt: opening.opened_at,
      };
    });

    return NextResponse.json({
      openings,
      total: openingsResult.total ?? 0,
    });
  } catch (error) {
    logServerError('peer-review:list', error);
    return NextResponse.json(
      {
        error: pickLocalized(lang, 'Sunucu hatası oluştu.', 'An internal server error occurred.'),
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
