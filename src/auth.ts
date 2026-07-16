import { betterAuth } from "better-auth";
import { passkey } from "@better-auth/passkey";
import type { Env } from "./types";

export function createAuth(env: Env) {
  return betterAuth({
    appName: "Text Codex",
    baseURL: env.PUBLIC_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: [env.PUBLIC_URL],
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET
          }
        }
      : undefined,
    plugins: [passkey()]
  });
}
