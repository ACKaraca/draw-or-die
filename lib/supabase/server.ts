import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import type { NextRequest } from 'next/server';

/**
 * Legacy shim kept for backwards compatibility during Supabase -> Appwrite migration.
 * New code should use `getAuthenticatedUserFromRequest` or Appwrite server helpers.
 */
export async function createClient(request?: NextRequest) {
    return {
        auth: {
            getUser: async () => {
                if (!request) {
                    return { data: { user: null }, error: new Error('Request is required for Appwrite auth') };
                }

                const user = await getAuthenticatedUserFromRequest(request);
                return {
                    data: {
                        user: user
                            ? { id: user.id, email: user.email }
                            : null,
                    },
                    error: user ? null : new Error('Unauthorized'),
                };
            },
        },
    };
}
