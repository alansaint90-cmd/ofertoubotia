import { z } from "zod";
import { connect, connectionState } from "@/lib/evolution/client";
import { hasSetupSession, sameOrigin, sessionCookie, setupReady, validSetupToken } from "@/lib/evolution/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), token: z.string().min(1).max(512) }),
  z.object({ action: z.literal("connect") }),
]);
const attempts = new Map<string, { count: number; until: number }>();

async function readLimitedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks).toString("utf8");
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
}

function noStore(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function GET(request: Request): Promise<Response> {
  if (!setupReady()) return noStore({ error: "not_configured" }, 503);
  if (!hasSetupSession(request)) return noStore({ error: "unauthorized" }, 401);
  try { return noStore(await connectionState()); }
  catch { return noStore({ error: "evolution_unavailable" }, 502); }
}

export async function POST(request: Request): Promise<Response> {
  if (!setupReady()) return noStore({ error: "not_configured" }, 503);
  if (!sameOrigin(request)) return noStore({ error: "forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return noStore({ error: "json_required" }, 415);
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > 1024) return noStore({ error: "invalid_request" }, 413);
  let data: unknown;
  try { const body = await readLimitedBody(request); if (body === null) return noStore({ error: "invalid_request" }, 413); data = JSON.parse(body); }
  catch { return noStore({ error: "invalid_request" }, 400); }
  const parsed = requestSchema.safeParse(data);
  if (!parsed.success) return noStore({ error: "invalid_request" }, 400);
  if (parsed.data.action === "login") {
    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const prior = attempts.get(address);
    if (prior && prior.until > Date.now() && prior.count >= 5) return noStore({ error: "rate_limited" }, 429);
    if (!validSetupToken(parsed.data.token)) {
      if (attempts.size > 1000) attempts.clear();
      attempts.set(address, { count: (prior?.until && prior.until > Date.now() ? prior.count : 0) + 1, until: Date.now() + 15 * 60 * 1000 });
      return noStore({ error: "invalid_token" }, 401);
    }
    attempts.delete(address);
    console.info(JSON.stringify({ event: "evolution_setup_login", instance: process.env.EVOLUTION_INSTANCE_NAME, at: new Date().toISOString() }));
    return noStore({ authorized: true }, 200, { "Set-Cookie": sessionCookie() });
  }
  if (!hasSetupSession(request)) return noStore({ error: "unauthorized" }, 401);
  try {
    const result = await connect();
    console.info(JSON.stringify({ event: "evolution_connect_requested", instance: process.env.EVOLUTION_INSTANCE_NAME, at: new Date().toISOString() }));
    return noStore(result);
  }
  catch { return noStore({ error: "evolution_unavailable" }, 502); }
}
