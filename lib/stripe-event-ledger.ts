import { Query } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_STRIPE_EVENTS_ID,
  getAdminTables,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';

/**
 * Removes the idempotency row written by `markStripeEventProcessed` so that Stripe's
 * retry of a failed delivery is handled again instead of being skipped as a duplicate.
 * Best-effort: errors are logged and reported via the return value, never thrown.
 */
export async function releaseStripeEvent(eventId: string): Promise<boolean> {
  try {
    const tables = getAdminTables();
    // Rows are created with ID.unique(), so the row is located through the unique event_id column.
    const result = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
      queries: [
        Query.equal('event_id', eventId),
        Query.limit(5),
      ],
    });

    await Promise.all(
      result.rows.map((row) =>
        tables.deleteRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
          rowId: row.$id,
        }),
      ),
    );

    return true;
  } catch (error) {
    logServerError('stripe-event-ledger.release', error, { eventId });
    return false;
  }
}
