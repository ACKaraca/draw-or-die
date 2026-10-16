// Replays failed Stripe webhook events through /api/webhook/stripe/replay.
// DRY-RUN BY DEFAULT. Follow docs/enterprise-audit/branches/16-fix-stripe-webhook-idempotency/RUNBOOK.md.
//
// Usage:
//   DOD_ADMIN_JWT=<appwrite jwt of a verified admin> node scripts/replay-stripe-events.mjs \
//     --base-url https://dev.drawordie.app [--event evt_123 --event evt_456] [--execute] [--include-rejected]
//
// Without --event it lists stored `failed` events. --execute requires explicit --event ids.

function parseArgs(argv) {
  const args = { baseUrl: process.env.DOD_BASE_URL || 'http://localhost:3000', eventIds: [], execute: false, includeRejected: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base-url') args.baseUrl = argv[++index];
    else if (arg === '--event') args.eventIds.push(argv[++index]);
    else if (arg === '--execute') args.execute = true;
    else if (arg === '--include-rejected') args.includeRejected = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jwt = String(process.env.DOD_ADMIN_JWT ?? '').trim();
  if (!jwt) throw new Error('DOD_ADMIN_JWT is required.');
  if (args.execute && args.eventIds.length === 0) throw new Error('--execute requires at least one --event id.');

  const response = await fetch(new URL('/api/webhook/stripe/replay', args.baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      eventIds: args.eventIds,
      dryRun: !args.execute,
      includeRejected: args.includeRejected,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  // JSON.stringify escapes control characters, so server-provided strings cannot forge extra output lines.
  process.stdout.write(
    `${JSON.stringify({ httpStatus: response.status, mode: args.execute ? 'EXECUTE' : 'DRY-RUN', ...payload }, null, 2)}\n`,
  );
  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(`[replay-stripe-events] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
