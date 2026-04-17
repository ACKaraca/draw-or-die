import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import type { BillingEventRow } from '@/lib/appwrite/server';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError } from '@/lib/logger';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SUMMARY_SCAN_LIMIT = 500;

function toDaysRemaining(periodEndIso: string | null): number | null {
  if (!periodEndIso) return null;
  const endMs = Date.parse(periodEndIso);
  if (!Number.isFinite(endMs)) return null;
  const diffMs = endMs - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const params = request.nextUrl.searchParams;
    const limitRaw = Number(params.get('limit') ?? String(DEFAULT_LIMIT));
    const offsetRaw = Number(params.get('offset') ?? '0');

    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitRaw)))
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const tables = getAdminTables();

    const [profile, paged, summaryRows] = await Promise.all([
      getOrCreateProfile(user),
      tables.listRows<BillingEventRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
        queries: [
          Query.equal('user_id', user.id),
          Query.orderDesc('createdAt'),
          Query.limit(limit),
          Query.offset(offset),
        ],
        total: true,
      }),
      tables.listRows<BillingEventRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
        queries: [
          Query.equal('user_id', user.id),
          Query.orderDesc('createdAt'),
          Query.limit(SUMMARY_SCAN_LIMIT),
        ],
      }),
    ]);

    const items = paged.rows.map((row) => ({
      id: row.$id,
      createdAt: row.$createdAt,
      eventType: row.event_type,
      amountCents: Number.isFinite(row.amount_cents) ? Number(row.amount_cents) : 0,
      currency: (row.currency || 'try').toLowerCase(),
      rapidoDelta: Number.isFinite(row.rapido_delta) ? Number(row.rapido_delta) : 0,
      rapidoBalanceAfter: Number.isFinite(row.rapido_balance_after) ? Number(row.rapido_balance_after) : 0,
      stripeSessionId: row.stripe_session_id || null,
      stripeCustomerId: row.stripe_customer_id || null,
      stripeSubscriptionId: row.stripe_subscription_id || null,
      metadataJson: row.metadata_json || null,
    }));

    const summary = summaryRows.rows.reduce(
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

    return NextResponse.json({
      membership: {
        isPremium: profile.is_premium,
        rapidoBalance: profile.rapido_pens,
        stripeSubscriptionId: profile.stripe_subscription_id,
        stripeCustomerId: profile.stripe_customer_id,
        subscriptionStatus: profile.subscription_status,
        currentPeriodStart: profile.subscription_current_period_start,
        currentPeriodEnd: profile.subscription_current_period_end,
        cancelAtPeriodEnd: profile.subscription_cancel_at_period_end,
        premiumStartedAt: profile.premium_started_at,
        premiumPriceCents: profile.premium_price_cents,
        premiumCurrency: profile.premium_currency,
        premiumInterval: profile.premium_interval,
        premiumPromoCode: profile.premium_promo_code,
        daysRemaining: toDaysRemaining(profile.subscription_current_period_end),
      },
      summary,
      items,
      total: paged.total,
    });
  } catch (error) {
    logServerError('api.billing.history.GET', error);
    return NextResponse.json({ error: 'Satın alım geçmişi alınamadı.' }, { status: 500 });
  }
}
