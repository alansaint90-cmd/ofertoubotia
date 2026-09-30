import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const AUTHORIZATION_URL = "https://auth.mercadolivre.com.br/authorization";
export const ML_STATE_COOKIE = "ofertou_ml_oauth";

function configuration() {
  const clientId = process.env.MERCADO_LIVRE_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) throw new Error("mercadolivre_not_configured");
  const parsed = new URL(redirectUri);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("mercadolivre_redirect_invalid");
  return { clientId, clientSecret, redirectUri };
}

export function mercadoLivreReady() {
  try { configuration(); return true; } catch { return false; }
}

function signature(payload: string) {
  return createHmac("sha256", configuration().clientSecret).update(payload).digest("base64url");
}

export function createOAuthState(workspaceId: string) {
  const payload = Buffer.from(JSON.stringify({ workspaceId, nonce: randomBytes(24).toString("base64url"), expiresAt: Date.now() + 10 * 60_000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyOAuthState(value: string, cookieValue: string | undefined) {
  if (!cookieValue || value !== cookieValue) throw new Error("oauth_state_invalid");
  const [payload, received, ...extra] = value.split(".");
  if (!payload || !received || extra.length) throw new Error("oauth_state_invalid");
  const expected = signature(payload);
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("oauth_state_invalid");
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { workspaceId?: unknown; expiresAt?: unknown };
  if (typeof state.workspaceId !== "string" || typeof state.expiresAt !== "number" || state.expiresAt < Date.now()) throw new Error("oauth_state_invalid");
  return state.workspaceId;
}

export function authorizationUrl(state: string) {
  const { clientId, redirectUri } = configuration();
  const url = new URL(AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url;
}

export function integrationReturnUrl(result: "conectado" | "erro") {
  const { redirectUri } = configuration();
  const url = new URL("/integrations", redirectUri);
  url.searchParams.set("mercadolivre", result);
  return url;
}

export async function exchangeAuthorizationCode(code: string) {
  const { clientId, clientSecret, redirectUri } = configuration();
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (!response.ok || !body || typeof body !== "object") throw new Error("oauth_exchange_failed");
  const token = body as Record<string, unknown>;
  if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string" || typeof token.expires_in !== "number") throw new Error("oauth_response_invalid");
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: typeof token.token_type === "string" ? token.token_type : "Bearer",
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    userId: typeof token.user_id === "number" || typeof token.user_id === "string" ? String(token.user_id) : "",
  };
}
