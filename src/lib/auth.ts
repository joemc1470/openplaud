import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "./env";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
        usePlural: true,
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    plugins: [
        // Lets authenticated integrations (e.g. the AgentOS skill polling
        // /api/recordings on Palace) use `Authorization: Bearer <key>`
        // instead of session cookies. Keys are created via the server-side
        // script at scripts/create-api-key.ts.
        apiKey(),
    ],
});

export type Session = typeof auth.$Infer.Session;
