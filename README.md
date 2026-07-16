# Text Codex

Text Codex gives an AI agent a private SMS inbox through Pingram. Users sign in, claim a US SMS number, verify the phone number they will text from, and copy a user-scoped Markdown connection note into their agent.

Live site: https://text-codex.a-8c6.workers.dev

## Table of Contents

- [About The Project](#about-the-project)
  - [Built With](#built-with)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Production Checklist](#production-checklist)
- [Safety Model](#safety-model)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)
- [AI Disclosure](#ai-disclosure)

## About The Project

Text Codex is a serverless Cloudflare Worker that connects a user's agent to SMS without exposing the Pingram API key to the client. Each user receives an isolated agent token and can only receive messages sent from their verified source phone number.

### Built With

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Better Auth](https://www.better-auth.com/)
- [Better Auth Passkey plugin](https://better-auth.com/docs/plugins/passkey)
- [Pingram](https://pingram.io/)
- TypeScript

## Getting Started

### Prerequisites

- Node.js and npm
- A Cloudflare account with Wrangler authentication
- A Pingram account with API access and US SMS number ordering enabled
- Google OAuth credentials for Google sign-in

### Installation

#### Recommended: let an agent install everything

For a guided end-to-end setup, open [INSTALL_WITH_AGENT.md](INSTALL_WITH_AGENT.md), copy its ready-made prompt into a coding agent with terminal and browser access, and follow along. The agent is instructed to clone the project, configure Cloudflare D1, Pingram, Google OAuth, and Worker secrets, deploy the app, and verify the live service.

#### Manual installation

1. Clone the repository:

   ```powershell
   git clone https://github.com/aminamos/text-codex.git
   cd text-codex
   ```

2. Install dependencies:

   ```powershell
   npm install
   ```

3. Apply the local D1 migration:

   ```powershell
   wrangler d1 migrations apply text-codex-db --local
   ```

4. Set local secrets in `.dev.vars` or configure them remotely with `wrangler secret put`.

5. Start the local Worker:

   ```powershell
   npm run dev
   ```

## Usage

1. Open the deployed site.
2. Sign in with Google or a registered passkey.
3. Enter the US phone number that will send texts to the assigned Pingram number.
4. Search for and claim an available Pingram number.
5. Copy the generated Markdown instructions into the agent you want to connect.
6. The agent reads `GET /api/agent/inbox` and replies with `POST /api/agent/reply` using the generated bearer token.

## Production Checklist

The deployed Worker currently uses `https://text-codex.a-8c6.workers.dev` as its public origin.

- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets.
- Add `https://text-codex.a-8c6.workers.dev/api/auth/callback/google` to the Google OAuth client's authorized redirect URIs.
- Configure a Pingram `SMS_INBOUND` events webhook at `/webhooks/pingram`.
- Set the Pingram webhook signing secret as `PINGRAM_WEBHOOK_SECRET`.
- Confirm Pingram billing and US number ordering are enabled.
- Replace the Worker URL with a custom domain if one is added later.

## Safety Model

- The Pingram API key and webhook secret are Worker secrets only.
- Agent tokens are shown once and stored hashed in D1.
- Inbound messages are accepted only when both the assigned Pingram number and verified source number match.
- Pingram webhook signatures are checked before events are parsed or stored.
- Cloudflare country routing rejects non-US requests.
- `.dev.vars`, `.env`, Wrangler state, and generated credentials are ignored.

## Roadmap

- Complete Google OAuth and Pingram webhook configuration for the production account.
- Add account-level number release and replacement flows.
- Add delivery status and message history controls.
- Add a custom production domain.

## Contributing

Contributions and issue reports are welcome. Please open an issue before making a large change, then submit a focused pull request with tests or verification steps for behavior that changed.

## Acknowledgments

- README structure adapted from [Best-README-Template](https://github.com/othneildrew/Best-README-Template).
- Authentication uses [Better Auth](https://www.better-auth.com/).
- SMS provisioning and delivery use [Pingram](https://pingram.io/).

## AI Disclosure

All code and documentation in this repository, including this README, were generated with AI assistance. Review, test, and secure the project for your own environment before deploying or relying on it.
