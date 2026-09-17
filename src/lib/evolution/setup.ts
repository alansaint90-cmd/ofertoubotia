import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "ofertou_evolution_setup";
const SESSION_SECONDS = 30 * 60;

export function setupReady(): boolean {
  const token = process.env.EVOLUTION_SETUP_TOKEN?.trim();
  const url = process.env.EVOLUTION_API_URL?.trim();
  const key = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  return Boolean(token && token.length >= 32 && !token.startsWith("SUBSTITUA_") && url && !url.includes("HOST_INTERNO_") && key && !key.startsWith("SUBSTITUA_") && instance);
}

function signature(value: string): string {
  return createHmac("sha256", process.env.EVOLUTION_SETUP_TOKEN!).update(value).digest("base64url");
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validSetupToken(value: unknown): boolean {
  const expected = process.env.EVOLUTION_SETUP_TOKEN?.trim();
  return Boolean(expected && typeof value === "string" && equal(signature(value), signature(expected)));
}

export function sessionCookie(): string {
  const payload = Buffer.from(JSON.stringify({ instance: process.env.EVOLUTION_INSTANCE_NAME, scope: "integrations:manage", expires: Date.now() + SESSION_SECONDS * 1000 })).toString("base64url");
  return `${COOKIE}=${payload}.${signature(payload)}; HttpOnly; SameSite=Strict; Path=/api/integrations/evolution; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function hasSetupSession(request: Request): boolean {
  if (!setupReady()) return false;
  const value = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [payload, mac, extra] = value.split(".");
  if (!payload || !mac || extra || !equal(signature(payload), mac)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.scope === "integrations:manage" && session.instance === process.env.EVOLUTION_INSTANCE_NAME && typeof session.expires === "number" && session.expires > Date.now();
  } catch { return false; }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
