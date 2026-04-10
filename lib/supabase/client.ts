import { account, client, databases } from '@/lib/appwrite';

/**
 * Legacy shim kept for backwards compatibility during Supabase -> Appwrite migration.
 * New code should import from `@/lib/appwrite` directly.
 */
export function createClient() {
    return {
        account,
        client,
        databases,
    };
}
