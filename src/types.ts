export interface Env {
  DB: D1Database;
  PUBLIC_URL: string;
  PINGRAM_BASE_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  PINGRAM_API_KEY?: string;
  PINGRAM_WEBHOOK_SECRET?: string;
  MIGRATION_KEY?: string;
}

export interface UserSession {
  user: { id: string; name: string; email: string };
  session: { id: string };
}
