import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { setupActor } from "@/lib/db/runtime";
import { auditLogs } from "@/lib/db/schema";
import { sameOrigin } from "@/lib/evolution/setup";
import { readLimitedJson } from "@/lib/http/read-json";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations/credentials";
import { itemIdSchema, queryRealProducts } from "@/lib/integrations/mercadolivre-products";
import { liveMercadoLivreToken } from "@/lib/integrations/mercadolivre-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "ofertou_ml_products";
const digest = (value: string) => createHash("sha256").update(value).digest();
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const input = z.discriminatedUnion("action", [z.strictObject({ action: z.literal("unlock"), token: z.string().min(32).max(256) }), z.strictObject({ action: z.literal("query"), itemId: itemIdSchema.optional(), offset: z.number().int().min(0).max(990).default(0) })]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const key = process.env.MERCADO_LIVRE_PRODUCTS_TOKEN?.trim();
  if (!key || key.length < 32) return reply({ error: "access_not_configured" }, 503);
  let data: z.infer<typeof input>;
  try { data = input.parse(await readLimitedJson(request, 2048)); } catch { return reply({ error: "invalid_request" }, 400); }
  try {
    const jar = await cookies();
    if (data.action === "unlock") {
      if (!timingSafeEqual(digest(data.token), digest(key))) return reply({ error: "unauthorized" }, 401);
      const actor = await setupActor("offers:write");
      await actor.db.insert(auditLogs).values({ workspaceId: actor.workspaceId, actorId: actor.actorId, operation: "mercadolivre.products_access", entityType: "workspace", entityId: actor.workspaceId, modifiedBy: actor.actorId });
      jar.set(COOKIE, encryptCredentials({ scope: "mercadolivre:products:manage", workspace: actor.workspaceId, actor: actor.actorId, keyVersion: digest(key).toString("hex"), expires: String(Date.now() + 900000) }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/integrations/mercadolivre/products", maxAge: 900 });
      return reply({ unlocked: true });
    }
    let session: Record<string, string>;
    try { session = decryptCredentials(jar.get(COOKIE)?.value ?? ""); } catch { return reply({ error: "unauthorized" }, 401); }
    if (session.scope !== "mercadolivre:products:manage" || !Number.isFinite(Number(session.expires)) || Number(session.expires) <= Date.now() || session.keyVersion !== digest(key).toString("hex")) return reply({ error: "unauthorized" }, 401);
    const actor = await setupActor("offers:write");
    if (session.workspace !== actor.workspaceId || session.actor !== actor.actorId) return reply({ error: "unauthorized" }, 401);
    let tokens = await liveMercadoLivreToken(actor);
    try { return reply(await queryRealProducts(tokens.accessToken, tokens.userId, data.itemId, data.offset)); }
    catch (error) {
      if (!(error instanceof Error) || error.message !== "token_rejected") throw error;
      tokens = await liveMercadoLivreToken(actor, tokens.accessToken);
      return reply(await queryRealProducts(tokens.accessToken, tokens.userId, data.itemId, data.offset));
    }
  } catch (error) {
    const safe = ["reconnect_required", "refresh_busy", "token_rejected", "permission_denied", "not_found", "rate_limited"];
    return reply({ error: error instanceof Error && safe.includes(error.message) ? error.message : "provider_unavailable" }, 503);
  }
}
