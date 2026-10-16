# Rapido Ledger Migration

## Invariants

- Ledger entries are immutable; corrections are counter-entries.
- Reservation lease state is operational and separate from the immutable economic journal.
- Reserve, settle, void, expire, refund, and correction each append a distinct journal entry; they never mutate a prior entry.
- Each source/idempotency key has at most one economic effect.
- Available balance cannot become negative.
- Reserved value is excluded from new availability.
- Only accepted operations settle; failure/cancel/timeout/refusal voids.
- Purchased, allowance, earned, and promotional value remain attributable.

## Migration phases

### 1. Schema and opening projection

Create immutable journal, account projection, and operational reservation structures through a versioned migration.
For every profile, create one auditable legacy opening entry equal to the current counter. Do not invent purchase/grant
source history.

### 2. Shadow

Keep the legacy counter authoritative. Write proposed ledger entries and compare the derived projection after every
operation. Alert on mismatch; do not repair automatically.

Journaled writers in this phase: AI reserve/settle/void (`app/api/ai-generate/billing.ts`), Stripe pack purchases
(`purchased`), Premium allowance top-ups (`allowance`) and pack revocations (`purchased` correction) in
`lib/stripe-entitlements.ts`, reward and promo credits (`promotional`). All share `lib/rapido-ledger-runtime.ts`
(`RAPIDO_LEDGER_MODE`, table-missing fallback). `GET /api/cron/rapido-sweep` (Bearer `CRON_SECRET`, every 15 min via
`vercel.json`) voids expired reservations. Drift check (read-only, exit 2 on drift):

```bash
node scripts/reconcile-billing.mjs --from <ISO after table provisioning> [--to <ISO>] [--threshold <cents>] [--skip-stripe]
```

### 3. Dual authority canary

Use atomic ledger reservation for a small cohort and maintain the legacy counter as a derived compatibility projection.
Test concurrency, duplicate, partial failure, provider timeout, reward grant, purchase, and adjustment.

### 4. Cutover

After zero unexplained drift for the approved observation window, make the ledger authoritative behind a server switch.
Keep the legacy field read-only through the rollback window.

### 5. Contract

Removal of the legacy counter is a later destructive schema decision requiring explicit owner approval. Retain immutable
ledger/audit history according to the approved financial retention policy.

## Rollback

Switch reads to the verified legacy projection and pause new risky operations. Preserve every journal entry,
reservation lease, and source record and investigate drift. Never overwrite balances or delete entries to make
reconciliation appear clean.
