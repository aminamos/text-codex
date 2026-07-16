# Install Text Codex with an AI agent

The easiest installation path is to give the prompt below to a coding agent that can use a terminal and a browser. The agent should do the work itself, explain each account-specific step, and verify the finished deployment.

You can use Codex, Claude Code, or another coding agent with shell access. Start it in the folder where you want Text Codex installed, then paste everything in the box below.

> Do not add API keys, OAuth secrets, webhook secrets, or generated tokens to this prompt. The agent will ask you to enter them securely when they are needed.

```text
Install and configure Text Codex for me from:
https://github.com/aminamos/text-codex

Act as the installer, not just an adviser. Do the safe work yourself with the terminal and browser tools available to you, and walk me through only the account logins, secret entry, consent, billing, and provider-dashboard steps that require me. Keep going until the deployment is verified or you can identify a concrete external blocker.

Rules:

- First inspect the repository README, package.json, wrangler.jsonc, migrations, .env.example, and source-defined environment bindings. Treat the repository as the source of truth.
- Detect my operating system and use commands that work in my shell. Use the repo-local Wrangler dependency through npm exec/npx instead of assuming a global Wrangler installation.
- Check whether Git, Node.js, and npm are installed. If something is missing, install it when safe and supported; otherwise give me the shortest exact step needed, verify it afterward, and continue.
- Never print, echo, commit, or place secrets in command history. Never ask me to paste secrets into chat. Use masked interactive prompts, provider dashboards, a password manager, or Wrangler's interactive `secret put` command.
- Never commit `.dev.vars`, `.env`, Wrangler state, credentials, tokens, or copied agent connection instructions.
- Ask before any action that creates a charge, especially ordering a Pingram phone number. Show me the price and selected number before asking.
- Do not reuse the repository owner's Cloudflare D1 database ID, Worker deployment, Google OAuth client, Pingram account, or secrets. Create and configure resources in my accounts.
- Use current official Cloudflare, Better Auth, Google OAuth, and Pingram documentation when provider UI labels or commands may have changed.

Complete these phases:

1. Prepare the project
   - Clone the repository if it is not already present, enter it, and report any existing local changes before editing.
   - Install dependencies and run `npm run check`.
   - Confirm Wrangler authentication with `npm exec wrangler whoami`. If necessary, launch `npm exec wrangler login`, let me complete the browser login, then verify the authenticated account.

2. Configure a new Cloudflare deployment
   - Ask me for the Worker name, using `text-codex` as the suggested default if it is available in my account.
   - Create a new D1 database for this installation. Capture its database ID, then update the local `wrangler.jsonc` Worker name, D1 database name, and D1 database ID. Preserve the `DB` binding and migrations directory.
   - Do not change the public URL until Wrangler reveals the actual deployed URL.
   - Apply the repository's D1 migrations to the new remote database and verify that Wrangler reports them as applied.

3. Collect and store configuration securely
   - Generate strong, independent random values for `BETTER_AUTH_SECRET` and the temporary `MIGRATION_KEY` without displaying them. Store `BETTER_AUTH_SECRET` in my password manager as well as Wrangler. Retain `MIGRATION_KEY` securely only long enough to run the protected migration, and store it with Wrangler until then.
   - Help me obtain a Pingram API key and configure inbound SMS. Store `PINGRAM_API_KEY` with Wrangler.
   - Deploy once if needed to learn the final workers.dev URL. Set `PUBLIC_URL` in `wrangler.jsonc` to that exact HTTPS origin and deploy again if it changed.
   - In Pingram, create an `SMS_INBOUND` events webhook pointing to `<PUBLIC_URL>/webhooks/pingram`. Generate or obtain its signing secret and store it as the Wrangler secret `PINGRAM_WEBHOOK_SECRET`. Confirm the webhook is active. Do not expose its value.
   - Walk me through creating a Google Web OAuth client for this deployment. Configure the authorized JavaScript origin as `<PUBLIC_URL>` and the authorized redirect URI as `<PUBLIC_URL>/api/auth/callback/google`. Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Wrangler secrets without exposing them.
   - Before migration, verify that all required Worker secrets exist by name: `BETTER_AUTH_SECRET`, `MIGRATION_KEY`, `PINGRAM_API_KEY`, `PINGRAM_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.

4. Finish database and application setup
   - Deploy the final configuration.
   - Run the protected Better Auth migration endpoint once using the securely retained `MIGRATION_KEY` in its `x-migration-key` request header, without printing the key. Confirm a successful response, then remove `MIGRATION_KEY` from the Worker and securely discard the temporary value so the production migration endpoint is disabled.
   - If the endpoint or Better Auth migration behavior has changed, inspect the installed Better Auth version and use its current official migration method. Do not weaken or bypass authentication.

5. Verify the real system
   - Run `npm run check` again and confirm the final deployment succeeds.
   - Request `<PUBLIC_URL>/health` and confirm an OK response.
   - Open the live site and have me complete Google sign-in. Verify that the authenticated app loads.
   - Verify Pingram number search works. Before ordering anything, show me the available number and recurring price and ask for explicit approval.
   - If I approve the charge, claim the number, send a real inbound SMS from my verified source number, confirm it appears through the agent inbox API, send a short reply through the agent reply API, and confirm it reaches my phone.
   - Have me copy the generated Markdown agent-connection instructions into the agent I actually want to receive texts. Warn me that this Markdown contains a bearer token and must remain private.

At the end, give me a concise handoff containing:

- the live URL;
- the Cloudflare Worker and D1 names;
- which checks passed;
- whether an end-to-end SMS round trip passed;
- any step I intentionally skipped;
- where to rotate each credential and how to redeploy;
- a reminder that releasing/replacing a number or deleting paid resources can affect billing.

Do not claim success from source inspection alone. Verify the deployed service, authentication, database, Pingram webhook, and (if I approve the number charge) the real SMS round trip.
```

The agent will pause when it needs you to sign in, enter a secret securely, approve a paid number, or complete a provider-specific browser screen. Everything else should be handled and verified by the agent.
