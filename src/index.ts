import { createAuth } from "./auth";
import { getMigrations } from "better-auth/db/migration";
import type { Env, UserSession } from "./types";

const htmlHeaders = { "content-type": "text/html; charset=UTF-8" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const country = (request as Request & { cf?: { country?: string } }).cf?.country;
    if (country && country !== "US" && !new URL(request.url).pathname.startsWith("/health")) {
      return json({ error: "Text Codex is currently available in the United States only." }, 403);
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/auth/")) {
      return createAuth(env).handler(request);
    }
    if (url.pathname === "/health") return json({ ok: true, country: country ?? "unknown" });
    if (url.pathname === "/admin/migrate" && request.method === "POST") return migrate(request, env);
    if (url.pathname === "/api/me" && request.method === "GET") return me(request, env);
    if (url.pathname === "/api/numbers/search" && request.method === "GET") return searchNumbers(request, env);
    if (url.pathname === "/api/numbers/claim" && request.method === "POST") return claimNumber(request, env);
    if (url.pathname === "/api/instructions" && request.method === "GET") return instructions(request, env);
    if (url.pathname === "/api/agent/inbox" && request.method === "GET") return agentInbox(request, env);
    if (url.pathname === "/api/agent/reply" && request.method === "POST") return agentReply(request, env);
    if (url.pathname === "/webhooks/pingram" && request.method === "POST") return pingramWebhook(request, env);
    if (url.pathname === "/client.js" && request.method === "GET") return new Response(CLIENT_JS + CLIENT_BOOT, { headers: { "content-type": "application/javascript; charset=UTF-8", "cache-control": "public, max-age=300" } });
    if (url.pathname === "/" || url.pathname === "/index.html") return new Response(INDEX_HTML.replace("</body></html>", "<script src=\"/client.js\"></script></body></html>"), { headers: htmlHeaders });
    return json({ error: "Not found" }, 404);
  }
};

async function getSession(request: Request, env: Env): Promise<UserSession | null> {
  const auth = createAuth(env);
  return await auth.api.getSession({ headers: request.headers }) as UserSession | null;
}

async function migrate(request: Request, env: Env): Promise<Response> {
  if (!env.MIGRATION_KEY || request.headers.get("x-migration-key") !== env.MIGRATION_KEY) return json({ error: "Not found" }, 404);
  const auth = createAuth(env);
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  return json({ ok: true });
}

async function me(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ user: null });
  const number = await env.DB.prepare("SELECT * FROM user_numbers WHERE user_id = ? AND released_at IS NULL LIMIT 1").bind(session.user.id).first();
  return json({ user: session.user, number: number ? { phoneNumber: number.phone_number, sourceNumber: number.source_number } : null });
}

async function searchNumbers(request: Request, env: Env): Promise<Response> {
  if (!await getSession(request, env)) return json({ error: "Sign in required" }, 401);
  if (!env.PINGRAM_API_KEY) return json({ error: "Pingram is not configured yet", numbers: [] }, 503);
  const input = new URL(request.url).searchParams;
  const qs = new URLSearchParams({ countryCode: "US", features: "sms", limit: "10" });
  if (input.get("areaCode")) qs.set("areaCode", input.get("areaCode")!.replace(/\D/g, "").slice(0, 3));
  return pingramFetch(env, `/numbers/available?${qs}`);
}

async function claimNumber(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  const body = await request.json() as { phoneNumber?: string; sourceNumber?: string };
  const phoneNumber = body.phoneNumber?.trim();
  const sourceNumber = normalizeNumber(body.sourceNumber);
  if (!phoneNumber || !sourceNumber) return json({ error: "A Pingram number and US source number are required" }, 400);
  const existing = await env.DB.prepare("SELECT phone_number FROM user_numbers WHERE user_id = ? AND released_at IS NULL LIMIT 1").bind(session.user.id).first();
  if (existing) return json({ error: "This account already has a number" }, 409);
  if (!env.PINGRAM_API_KEY) return json({ error: "Pingram is not configured yet" }, 503);
  const ordered = await pingramFetch(env, "/numbers/order", { method: "POST", body: JSON.stringify({ phoneNumber }) });
  if (!ordered.ok) return ordered;
  const token = `tcx_${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await digest(token);
  const encrypted = await encryptToken(token, env.BETTER_AUTH_SECRET);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user_numbers (id, user_id, phone_number, source_number, created_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), session.user.id, phoneNumber, sourceNumber, undefined),
    env.DB.prepare("INSERT INTO agent_tokens (id, user_id, token_hash, token_ciphertext, token_iv, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), session.user.id, tokenHash, encrypted.ciphertext, encrypted.iv)
  ]);
  return json({ ok: true, phoneNumber, sourceNumber, agentToken: token }, 201);
}

async function instructions(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  const row = await env.DB.prepare("SELECT un.phone_number, un.source_number, at.token_ciphertext, at.token_iv FROM user_numbers un JOIN agent_tokens at ON at.user_id = un.user_id WHERE un.user_id = ? AND un.released_at IS NULL ORDER BY at.created_at DESC LIMIT 1").bind(session.user.id).first<{ phone_number: string; source_number: string; token_ciphertext: string; token_iv: string }>();
  if (!row) return json({ error: "Claim a number first" }, 409);
  const token = await decryptToken(row.token_ciphertext, row.token_iv, env.BETTER_AUTH_SECRET);
  return new Response(`# Text Codex agent connection\n\nYour Text Codex number is **${row.phone_number}**. Your verified phone is **${row.source_number}**.\n\nUse the Text Codex API with your private agent token. Never expose the token in a public repository or client-side code.\n\n- API base: ${env.PUBLIC_URL}\n- Read inbound messages: GET /api/agent/inbox\n- Send a reply: POST /api/agent/reply\n- Authorization: Bearer ${token}\n\nWhen a new message arrives, read it, perform the requested task, and reply through the API. Keep replies concise and do not send messages unless the user asked for them.`, { headers: { "content-type": "text/markdown; charset=UTF-8" } });
}

async function agentInbox(request: Request, env: Env): Promise<Response> {
  const userId = await tokenUser(request, env);
  if (!userId) return json({ error: "Invalid agent token" }, 401);
  const rows = await env.DB.prepare("SELECT id, direction, body, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all();
  return json({ messages: rows.results });
}

async function agentReply(request: Request, env: Env): Promise<Response> {
  const userId = await tokenUser(request, env);
  if (!userId) return json({ error: "Invalid agent token" }, 401);
  const row = await env.DB.prepare("SELECT phone_number, source_number FROM user_numbers WHERE user_id = ? AND released_at IS NULL LIMIT 1").bind(userId).first<{ phone_number: string; source_number: string }>();
  const body = await request.json() as { text?: string };
  const text = body.text?.trim();
  if (!row || !text || text.length > 800) return json({ error: "A number and message under 800 characters are required" }, 400);
  const sent = await pingramFetch(env, "/send", { method: "POST", body: JSON.stringify({ type: "text_codex_agent_reply", to: { id: userId, number: row.source_number }, sms: { message: text } }) });
  if (!sent.ok) return sent;
  await env.DB.prepare("INSERT INTO messages (id, user_id, direction, body, created_at) VALUES (?, ?, 'outbound', ?, datetime('now'))").bind(crypto.randomUUID(), userId, text).run();
  return json({ ok: true });
}

async function pingramWebhook(request: Request, env: Env): Promise<Response> {
  const raw = await request.text();
  if (!env.PINGRAM_WEBHOOK_SECRET || !await verifyPingramSignature(request, raw, env.PINGRAM_WEBHOOK_SECRET)) return json({ error: "Invalid signature" }, 401);
  const event = JSON.parse(raw) as { eventType?: string; from?: string; to?: string; text?: string; receivedAt?: string };
  if (event.eventType !== "SMS_INBOUND" || !event.from || !event.to || !event.text) return new Response(null, { status: 204 });
  const owner = await env.DB.prepare("SELECT user_id, source_number FROM user_numbers WHERE phone_number = ? AND released_at IS NULL LIMIT 1").bind(event.to).first<{ user_id: string; source_number: string }>();
  if (!owner || normalizeNumber(event.from) !== owner.source_number) return new Response(null, { status: 204 });
  await env.DB.prepare("INSERT OR IGNORE INTO messages (id, user_id, direction, body, created_at) VALUES (?, ?, 'inbound', ?, ?)").bind(request.headers.get("X-Pingram-Id") ?? crypto.randomUUID(), owner.user_id, event.text, event.receivedAt ?? new Date().toISOString()).run();
  return new Response(null, { status: 204 });
}

async function tokenUser(request: Request, env: Env): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const row = await env.DB.prepare("SELECT user_id FROM agent_tokens WHERE token_hash = ? AND revoked_at IS NULL").bind(await digest(token)).first<{ user_id: string }>();
  return row?.user_id ?? null;
}

async function pingramFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${env.PINGRAM_API_KEY}`);
  headers.set("content-type", "application/json");
  const response = await fetch(`${env.PINGRAM_BASE_URL}${path}`, { ...init, headers });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}

async function verifyPingramSignature(request: Request, body: string, secret: string): Promise<boolean> {
  const id = request.headers.get("X-Pingram-Id");
  const signature = request.headers.get("X-Pingram-Signature");
  const timestamp = request.headers.get("X-Pingram-Timestamp");
  if (!id || !signature || !timestamp || Math.abs(Date.now() - Number(timestamp)) > 300000 || !signature.startsWith("v1,")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, hexToBytes(signature.slice(3)) as unknown as BufferSource, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
}

function normalizeNumber(value?: string): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptToken(token: string, secret: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, await encryptionKey(secret), new TextEncoder().encode(token));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptToken(ciphertext: string, iv: string, secret: string): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) as unknown as BufferSource }, await encryptionKey(secret), base64ToBytes(ciphertext) as unknown as BufferSource);
  return new TextDecoder().decode(plain);
}

function bytesToBase64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }

function hexToBytes(value: string): Uint8Array { return new Uint8Array(value.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []); }
function json(value: unknown, status = 200): Response { return Response.json(value, { status, headers: { "cache-control": "no-store" } }); }

const CLIENT_JS = `async function passkey(){const status=document.querySelector('#status');status.textContent='Waiting for your passkey...';try{const {startAuthentication}=await import('https://esm.sh/@simplewebauthn/browser@13.3.0');const options=await fetch('/api/auth/passkey/generate-authenticate-options');const optionsJSON=await options.json();const response=await startAuthentication({optionsJSON});const verified=await fetch('/api/auth/passkey/verify-authentication',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({response})});if(!verified.ok)throw new Error('Passkey verification failed');location.reload()}catch(error){status.textContent=error instanceof Error?error.message:'Passkey sign-in was cancelled.'}}async function registerPasskey(){const status=document.querySelector('#status');status.textContent='Creating a passkey for this device...';try{const {startRegistration}=await import('https://esm.sh/@simplewebauthn/browser@13.3.0');const options=await fetch('/api/auth/passkey/generate-register-options');const optionsJSON=await options.json();const response=await startRegistration({optionsJSON});const verified=await fetch('/api/auth/passkey/verify-registration',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({response,name:'Primary device'})});if(!verified.ok)throw new Error('Passkey registration failed');status.textContent='Passkey added.'}catch(error){status.textContent=error instanceof Error?error.message:'Passkey registration was cancelled.'}}`;

const CLIENT_BOOT = `fetch('/api/me').then(r=>r.json()).then(data=>{if(data.user&&!document.querySelector('[data-passkey-add]')){const button=document.createElement('button');button.className='button secondary';button.dataset.passkeyAdd='true';button.textContent='Add this device as a passkey';button.onclick=registerPasskey;document.querySelector('#app')?.prepend(button)}}).catch(()=>{});`;

const INDEX_HTML = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Text Codex</title><style>
:root{color-scheme:dark;--ink:#f3f0e8;--muted:#9d9a91;--line:#35352f;--paper:#11120f;--accent:#e6c34d;--danger:#d67d69}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0%,#39351a 0,#11120f 42%);color:var(--ink);font:16px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}main{max-width:1040px;margin:0 auto;padding:28px 22px 80px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:20px}h1{font:700 clamp(32px,6vw,72px)/.95 Georgia,serif;letter-spacing:-.06em;margin:70px 0 18px;max-width:700px}p{color:var(--muted);max-width:640px}.mark{color:var(--accent);font-weight:700}.panel{margin-top:38px;border:1px solid var(--line);background:#171813cc;padding:22px;max-width:760px}.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.button{border:1px solid var(--accent);background:var(--accent);color:#171813;padding:12px 16px;font:inherit;cursor:pointer}.button.secondary{background:transparent;color:var(--ink);border-color:var(--line)}input{background:#0c0d0b;color:var(--ink);border:1px solid var(--line);padding:12px;font:inherit;width:230px}.status{margin-top:18px;white-space:pre-wrap;color:var(--accent)}.muted{font-size:13px;color:var(--muted)}code{color:var(--accent)}a{color:var(--ink)}#app{min-height:300px}</style></head><body><main><header><div><span class="mark">TEXT CODEX</span> / US NODE</div><a href="https://github.com/aminamos/text-codex">source</a></header><section><h1>Give your agent a number.</h1><p>Claim a private US SMS number, point your own phone at it, and paste one generated Markdown instruction into the agent you already use.</p><div id="app" class="panel"><div class="row"><button class="button" onclick="google()">Continue with Google</button><button class="button secondary" onclick="passkey()">Use a passkey</button></div><p class="muted">Text Codex is currently geolocked to the United States. Pingram credentials stay server-side.</p><div id="status" class="status"></div></div></section></main><script>
const status=document.querySelector('#status');function google(){location.href='/api/auth/sign-in/social?provider=google&callbackURL=/'}async function passkey(){status.textContent='Passkey sign-in is being initialized...';try{const r=await fetch('/api/auth/sign-in/passkey',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});status.textContent=r.ok?'Continue in your passkey prompt.':'Passkey setup is not configured yet.'}catch(e){status.textContent='Passkey unavailable.'}}async function boot(){const r=await fetch('/api/me');const data=await r.json();if(!data.user)return;if(data.number){document.querySelector('#app').innerHTML='<strong>Number ready.</strong><p>Pingram: <code>'+data.number.phoneNumber+'</code><br>Your phone: <code>'+data.number.sourceNumber+'</code></p><button class="button" onclick="download()">Copy agent instructions</button><div id="status" class="status"></div>';return}document.querySelector('#app').innerHTML='<strong>Claim your number.</strong><p>Enter your US phone number and an area code preference. Pingram will show available numbers before anything is ordered.</p><div class="row"><input id="source" placeholder="Your phone: YOUR_US_PHONE_NUMBER"><input id="area" placeholder="Area code (optional)"><button class="button" onclick="search()">Find a number</button></div><div id="status" class="status"></div>'}async function search(){status.textContent='Searching Pingram...';const area=document.querySelector('#area').value;const r=await fetch('/api/numbers/search?areaCode='+encodeURIComponent(area));const d=await r.json();if(!r.ok){status.textContent=d.error;return}status.innerHTML=(d.numbers||[]).map(n=>'<button class="button secondary" onclick="claim(\\''+n.phoneNumber+'\\')">Claim '+n.phoneNumber+' / $'+n.monthlyPrice+'</button>').join('<br>')}async function claim(phoneNumber){const r=await fetch('/api/numbers/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phoneNumber,sourceNumber:document.querySelector('#source').value})});const d=await r.json();status.textContent=r.ok?'Number claimed. Copying your private instructions...':d.error;if(r.ok){await navigator.clipboard.writeText('# Text Codex agent connection\\n\\nAPI base: '+location.origin+'\\n\\nAuthorization: Bearer '+d.agentToken+'\\n\\nRead GET /api/agent/inbox and reply with POST /api/agent/reply.');location.reload()}}async function download(){const r=await fetch('/api/instructions');const text=await r.text();await navigator.clipboard.writeText(text);status.textContent='Markdown copied to your clipboard.'}boot();</script></body></html>`;
