import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;
const eventSchema = z.object({
  event: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  instance: z.string().min(1).max(128),
  data: z.unknown().optional(),
});

function matchesSecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const actualHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

async function readBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  if (!secret || secret.length < 32 || secret.startsWith("SUBSTITUA_") || !instanceName) {
    return Response.json({ error: "webhook_unavailable" }, { status: 503 });
  }
  if (!matchesSecret(request.headers.get("x-ofertou-webhook-secret"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "json_required" }, { status: 415 });
  }
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: string | null;
  try {
    body = await readBody(request);
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (body === null) return Response.json({ error: "payload_too_large" }, { status: 413 });

  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "invalid_event" }, { status: 400 });
  if (parsed.data.instance !== instanceName) {
    return Response.json({ error: "unauthorized" }, { status: 403 });
  }

  // Recebimento somente: a associação a workspace e a persistência ainda não estão ativas.
  return Response.json({ received: true, processed: false }, { status: 202 });
}
