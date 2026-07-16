# Text Codex

Text Codex is a US-only Cloudflare Worker that gives an agent a private SMS number through Pingram. A user signs in, claims a number, verifies the phone they will text from, and copies a user-scoped Markdown connection note into their agent.

## AI disclosure

All code and documentation in this repository, including this README, were generated with AI assistance. Review, test, and secure the project for your own environment before deploying or relying on it.

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

## Production checklist

The deployed Worker uses `https://text-codex.a-8c6.workers.dev` as its public origin. Before announcing the app as fully live:

- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets.
- Add `https://text-codex.a-8c6.workers.dev/api/auth/callback/google` to the Google OAuth client's authorized redirect URIs.
- Configure the Pingram `SMS_INBOUND` events webhook and set its signing secret as `PINGRAM_WEBHOOK_SECRET`.
- Confirm the Pingram account can search and order US SMS numbers and has billing enabled.

## Pingram setup

Configure one Pingram events webhook for `SMS_INBOUND` at `/webhooks/pingram`, then store the returned webhook secret as `PINGRAM_WEBHOOK_SECRET`. Number search uses `GET /numbers/available?countryCode=US&features=sms`; ordering uses `POST /numbers/order`.
