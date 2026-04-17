import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Get the current session on the server
 * Requires server component or API route
 *
 * Supports two auth paths:
 *   1. Session cookie (Better Auth default) — set by the browser login flow
 *   2. Bearer API key (apiKey plugin) — `Authorization: Bearer <key>` header,
 *      resolved to the owning user via `auth.api.verifyApiKey`. Returns a
 *      session-shaped object so downstream route handlers don't care which
 *      path authenticated the caller.
 */
export async function getSession() {
    const hdrs = await headers();

    // 1. Session cookie path
    const session = await auth.api.getSession({ headers: hdrs });
    if (session) return session;

    // 2. API key path
    const authHeader = hdrs.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const key = authHeader.slice(7).trim();
        if (key) {
            try {
                const result = await auth.api.verifyApiKey({
                    body: { key },
                });
                if (result.valid && result.key) {
                    return {
                        user: { id: result.key.userId },
                        session: null,
                    } as unknown as NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
                }
            } catch {
                // Invalid key — fall through to null
            }
        }
    }

    return null;
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components
 */
export async function requireAuth() {
    const session = await getSession();

    if (!session?.user) {
        redirect("/login");
    }

    return session;
}

/**
 * Redirect to dashboard if already authenticated
 * Use in login/register pages
 */
export async function redirectIfAuthenticated() {
    const session = await getSession();

    if (session?.user) {
        redirect("/dashboard");
    }
}
