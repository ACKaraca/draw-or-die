import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  APPWRITE_TABLE_GALLERY_ID,
  APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
  BillingEventRow,
  MemorySnippetRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';
import {
  getProfileStatsCache,
  getProfileStatsInflight,
  setProfileStatsCache,
  setProfileStatsInflight,
} from '@/lib/profile-stats-cache';

const BILLING_SUMMARY_SCAN_LIMIT = 500;
const MEMORY_SNIPPET_LIMIT = 24;

function normalizeCategory(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (value === 'CATEGORY_1' || value === 'USER_PROFILE') return 'USER_PROFILE';
  if (value === 'CATEGORY_2' || value === 'RECENT_CONTEXT') return 'RECENT_CONTEXT';
  if (value === 'CATEGORY_3' || value === 'ARCHITECT_STYLE_HIDDEN') return 'ARCHITECT_STYLE_HIDDEN';
  return value || 'USER_PROFILE';
}

async function countRowsByUser(
  tables: ReturnType<typeof getAdminTables>,
  tableId: string,
  userId: string,
  extraQueries: string[] = [],
): Promise<number> {
  const result = await tables.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId,
    queries: [
      Query.equal('user_id', userId),
      ...extraQueries,
      Query.limit(1),
    ],
    total: true,
  });

  if (typeof result.total === 'number' && Number.isFinite(result.total)) {
    return Math.max(0, Math.trunc(result.total));
  }

  return result.rows.length;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const cached = getProfileStatsCache<Record<string, unknown>>(user.id);
    if (cached) {
      return NextResponse.json(cached);
    }

    const inflight = getProfileStatsInflight<Record<string, unknown>>(user.id);
    if (inflight) {
      return NextResponse.json(await inflight);
    }

    const payloadPromise = (async () => {
      const tables = getAdminTables();

      const [historyTotal, approvedTotal, archivedTotal, pendingTotal, billingResult, memoryResult] = await Promise.all([
        countRowsByUser(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, user.id),
        countRowsByUser(tables, APPWRITE_TABLE_GALLERY_ID, user.id, [Query.equal('status', 'approved')]),
        countRowsByUser(tables, APPWRITE_TABLE_GALLERY_ID, user.id, [Query.equal('status', 'archived')]),
        countRowsByUser(tables, APPWRITE_TABLE_GALLERY_ID, user.id, [Query.equal('status', 'pending')]),
        tables.listRows<BillingEventRow>({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
          queries: [
            Query.equal('user_id', user.id),
            Query.limit(BILLING_SUMMARY_SCAN_LIMIT),
          ],
        }),
        tables.listRows<MemorySnippetRow>({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
          queries: [
            Query.equal('user_id', user.id),
            Query.equal('visible_to_user', true),
            Query.equal('deleted_by_user', false),
            Query.limit(MEMORY_SNIPPET_LIMIT),
          ],
        }),
      ]);

      const billingSummary = billingResult.rows.reduce(
        (acc, row) => {
          const amount = Number.isFinite(row.amount_cents) ? Number(row.amount_cents) : 0;
          const rapidoDelta = Number.isFinite(row.rapido_delta) ? Number(row.rapido_delta) : 0;

          acc.totalAmountCents += amount;

          if (rapidoDelta > 0) {
            acc.totalRapidoPurchased += rapidoDelta;
            acc.rapidoPurchaseCount += 1;
          }

          if (row.event_type === 'premium_monthly' || row.event_type === 'premium_yearly') {
            acc.membershipPurchaseCount += 1;
          }

          return acc;
        },
        {
          totalAmountCents: 0,
          totalRapidoPurchased: 0,
          rapidoPurchaseCount: 0,
          membershipPurchaseCount: 0,
        },
      );

      const memorySnippets = memoryResult.rows
        .map((row) => ({
          id: row.$id,
          category: normalizeCategory(row.category || ''),
          snippet: row.snippet,
          updatedFromOperation: row.updated_from_operation || null,
          updatedAt: row.$updatedAt,
        }))
        .filter((row) => row.snippet && row.category);

      const responsePayload = {
        stats: {
          historyTotal,
          approvedTotal,
          archivedTotal,
          pendingTotal,
        },
        billingSummary,
        billingCurrency: (billingResult.rows[0]?.currency || 'try').toLowerCase(),
        memorySnippets,
      };

      setProfileStatsCache(user.id, responsePayload);
      return responsePayload;
    })();

    return NextResponse.json(await setProfileStatsInflight(user.id, payloadPromise));
  } catch (error) {
    logServerError('api.profile.stats.GET', error);
    return NextResponse.json({ error: 'Profil istatistikleri alınamadı.' }, { status: 500 });
  }
}
