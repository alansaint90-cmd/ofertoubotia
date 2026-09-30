import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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

export async function refreshMercadoLivreToken(refreshToken: string) {
  const { clientId, clientSecret } = configuration();
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("reconnect_required");
  const data: unknown = await response.json();
  const { z } = await import("zod");
  const token = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), expires_in: z.number().positive().finite(), user_id: z.union([z.number(), z.string()]).optional() }).parse(data);
  return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(), userId: token.user_id === undefined ? undefined : String(token.user_id) };
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
  url.searchParams.set("code_challenge", createHash("sha256").update(codeVerifier(state)).digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

// Domain-separated HMAC keeps the verifier private while binding it to this attempt.
function codeVerifier(state: string) {
  return createHmac("sha256", configuration().clientSecret).update(`ofertou:ml:pkce:${state}`).digest("base64url");
}

export type MercadoLivreOAuthError = "autorizacao_recusada" | "estado_invalido" | "workspace_invalido" | "troca_token_falhou" | "gravacao_falhou" | "configuracao_invalida";

export function integrationReturnUrl(result: "conectado" | "erro", reason?: MercadoLivreOAuthError) {
  const { redirectUri } = configuration();
  const url = new URL("/integrations", redirectUri);
  url.searchParams.set("mercadolivre", result);
  if (result === "erro" && reason) url.searchParams.set("motivo", reason);
  return url;
}

export async function exchangeAuthorizationCode(code: string, state: string) {
  const { clientId, clientSecret, redirectUri } = configuration();
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, code_verifier: codeVerifier(state) }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const knownErrors = ["invalid_client", "invalid_grant", "invalid_scope", "invalid_request", "unsupported_grant_type", "forbidden", "local_rate_limited", "unauthorized_client", "unauthorized_application"];
    const reported = body && typeof body === "object" && "error" in body ? body.error : undefined;
    const safeError = typeof reported === "string" && knownErrors.includes(reported) ? reported : "unknown_error";
    console.error("mercadolivre.oauth.exchange_failed", { status: response.status, error: safeError });
    throw new Error("oauth_exchange_failed");
  }
  if (!body || typeof body !== "object") throw new Error("oauth_response_invalid");
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
