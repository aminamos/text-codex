# Text Codex

Text Codex is a US-only Cloudflare Worker that gives an agent a private SMS number through Pingram. A user signs in, claims a number, verifies the phone they will text from, and copies a user-scoped Markdown connection note into their agent.

## Safety model

- The Pingram API key and webhook secret are Worker secrets only.
- Agent tokens are shown once and stored hashed in D1.
- Inbound messages are accepted only when both the assigned Pingram number and verified source number match.
- Pingram webhook signatures are checked before parsing or storing events.
- Cloudflare country routing rejects non-US requests.
- `.dev.vars`, `.env`, Wrangler state, and generated credentials are ignored.

## Local setup

```powershell
npm install
wrangler d1 migrations apply text-codex-db --local
npm run dev
```

Set secrets locally in `.dev.vars` or remotely with `wrangler secret put`. Google OAuth must allow `/api/auth/callback/google` on the deployed origin.

## Pingram setup

Configure one Pingram events webhook for `SMS_INBOUND` at `/webhooks/pingram`, then store the returned webhook secret as `PINGRAM_WEBHOOK_SECRET`. Number search uses `GET /numbers/available?countryCode=US&features=sms`; ordering uses `POST /numbers/order`.
