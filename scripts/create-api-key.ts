#!/usr/bin/env bun
/**
 * Create an API key for a user. One-shot helper for bootstrapping
 * programmatic access (e.g. the AgentOS skill that polls /api/recordings).
 *
 * Usage (inside the openplaud container):
 *   bun scripts/create-api-key.ts <user-email> <key-name>
 *
 * Prints the full API key exactly once to stdout. Save it immediately —
 * Better Auth hashes the key on insert and never reveals the plaintext
 * again. Lost keys can't be recovered; create a new one.
 *
 * The returned key is used as: `Authorization: Bearer <key>`.
 */
import { auth } from "../src/lib/auth";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const [email, name] = process.argv.slice(2);
    if (!email || !name) {
        console.error("usage: bun scripts/create-api-key.ts <user-email> <key-name>");
        process.exit(2);
    }

    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (!user) {
        console.error(`no user found with email ${email}`);
        process.exit(1);
    }

    console.error(`creating API key "${name}" for user ${user.email} (id=${user.id})`);

    const result = await auth.api.createApiKey({
        body: {
            name,
            userId: user.id,
            // No expiration; set to a Unix timestamp (ms) to add one.
            // expiresIn: 60 * 60 * 24 * 365, // seconds, if desired
        },
    });

    if (!result || !result.key) {
        console.error("failed to create API key:", result);
        process.exit(1);
    }

    // result.key holds the plaintext key (only time we see it).
    // Print it raw to stdout so it can be captured in scripts.
    process.stdout.write(result.key);
    console.error(""); // final newline to stderr for human reading
    console.error(`✓ key created (id=${result.id}, starts=${result.start})`);
    console.error("Save the key above. It cannot be retrieved again.");
    process.exit(0);
}

main().catch((e) => {
    console.error("error:", e);
    process.exit(1);
});
