import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { hasSetupSession, sameOrigin, setupReady } from "@/lib/evolution/setup";
import { TARGET_INVITE_HASH } from "@/lib/evolution/target";
import { setupActor } from "@/lib/db/runtime";
import { auditLogs, dispatches, offers, whatsappGroups, whatsappInstances, productCollection } from "@/lib/db/schema";
import { manualReviewSchema } from "@/lib/integrations/product-review";
import { readLimitedJson } from "@/lib/http/read-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.strictObject({
  requestId: z.uuid(),
  productId: z.uuid(),
  updatedAt: z.string().datetime(),
  confirmed: z.literal(true),
});
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function checkedLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname === "localhost") return null;
    return url.toString();
  } catch { return null; }
}

export async function GET(request: Request): Promise<Response> {
  if (!setupReady() || !hasSetupSession(request)) return reply({ error: "unauthorized" }, 401);
  const requestId = new URL(request.url).searchParams.get("requestId");
  const id = requestId ? z.uuid().safeParse(requestId) : null;
  if (id && !id.success) return reply({ error: "invalid_request" }, 400);
  try {
    const { db, workspaceId } = await setupActor("dispatches:publish");
    if (!id) {
      const rows = await db.select({ id: dispatches.id, status: dispatches.status, sentAt: dispatches.sentAt, createdAt: dispatches.createdAt, headline: offers.headline, groupName: whatsappGroups.name })
        .from(dispatches).innerJoin(offers, eq(offers.id, dispatches.offerId)).innerJoin(whatsappGroups, eq(whatsappGroups.id, dispatches.groupId))
        .where(and(eq(dispatches.workspaceId, workspaceId), eq(dispatches.isDeleted, false), eq(offers.isDeleted, false), eq(whatsappGroups.isDeleted, false)))
        .orderBy(desc(dispatches.createdAt)).limit(20);
      return reply({ dispatches: rows });
    }
    const [row] = await db.select({ status: dispatches.status, sentAt: dispatches.sentAt, lastError: dispatches.lastError })
      .from(dispatches).where(and(eq(dispatches.workspaceId, workspaceId), eq(dispatches.requestId, id.data), eq(dispatches.isDeleted, false))).limit(1);
    return row ? reply(row) : reply({ error: "not_found" }, 404);
  } catch { return reply({ error: "dispatch_unavailable" }, 503); }
}

export async function POST(request: Request): Promise<Response> {
  if (!setupReady() || !hasSetupSession(request)) return reply({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "json_required" }, 415);
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > 8192) return reply({ error: "invalid_request" }, 413);
  let input: unknown;
  try { input = await readLimitedJson(request, 8192); }
  catch (error) { return reply({ error: "invalid_request" }, error instanceof Error && error.message === "too_large" ? 413 : 400); }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return reply({ error: "invalid_request" }, 400);
  try {
    const { db, workspaceId, actorId } = await setupActor("dispatches:publish");
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext(${parsed.data.productId}))`);
      const [product] = await tx.select().from(productCollection).where(and(eq(productCollection.id, parsed.data.productId), eq(productCollection.workspaceId, workspaceId), eq(productCollection.isDeleted, false), eq(productCollection.isActive, true))).for("update").limit(1);
      if (!product || product.updatedAt.toISOString() !== parsed.data.updatedAt) throw new Error("product_changed");
      const details = manualReviewSchema.safeParse({ ...(product.details as object), confirmed: true });
      if (!details.success || !(product.details as { reviewedAt?: string }).reviewedAt) throw new Error("review_required");
      const link = checkedLink(product.affiliateUrl);
      if (!link) throw new Error("invalid_offer");
      const message = `${details.data.title}\n\n${/R\$/.test(details.data.description) ? "" : details.data.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + "\n\n"}${details.data.description}\n\n🛒 ${link}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext(${product.id}))`);
      const [existing] = await tx.select({ id: dispatches.id, status: dispatches.status }).from(dispatches)
        .where(and(eq(dispatches.workspaceId, workspaceId), eq(dispatches.requestId, parsed.data.requestId), eq(dispatches.isDeleted, false))).limit(1);
      if (existing) return { id: existing.id, status: existing.status, repeated: true };
      const [group] = await tx.select({ id: whatsappGroups.id, metadata: whatsappGroups.metadata })
        .from(whatsappGroups).innerJoin(whatsappInstances, eq(whatsappGroups.instanceId, whatsappInstances.id))
        .where(and(eq(whatsappGroups.workspaceId, workspaceId), eq(whatsappGroups.isActive, true), eq(whatsappGroups.isDeleted, false), sql`${whatsappGroups.metadata}->>'inviteHash' = ${TARGET_INVITE_HASH}`, eq(whatsappInstances.instanceName, process.env.EVOLUTION_INSTANCE_NAME!), eq(whatsappInstances.isDeleted, false)))
        .limit(1);
      if (!group || (group.metadata as { inviteHash?: string }).inviteHash !== TARGET_INVITE_HASH) throw new Error("group_not_bound");
      const [recent] = await tx.select({ id: dispatches.id }).from(dispatches)
        .innerJoin(offers, eq(offers.id, dispatches.offerId))
        .where(and(eq(dispatches.workspaceId, workspaceId), eq(dispatches.groupId, group.id), eq(offers.externalProductId, product.id), inArray(dispatches.status, ["queued", "processing", "accepted", "uncertain"]), gte(dispatches.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)), eq(dispatches.isDeleted, false), eq(offers.isDeleted, false)))
        .limit(1);
      if (recent) throw new Error("duplicate_24h");
      const [offer] = await tx.insert(offers).values({ workspaceId, provider: "mercadolivre_collection", externalProductId: product.id, productSnapshot: { ...details.data, source: "collection", productId: product.id, affiliateLink: link, confirmedByOperator: true }, headline: details.data.title, body: message, status: "queued", createdBy: actorId, modifiedBy: actorId }).returning({ id: offers.id });
      const [dispatch] = await tx.insert(dispatches).values({ requestId: parsed.data.requestId, workspaceId, offerId: offer.id, groupId: group.id, status: "queued", queuedAt: new Date(), modifiedBy: actorId }).returning({ id: dispatches.id });
      await tx.insert(auditLogs).values({ workspaceId, actorId, operation: "dispatch.queued", entityType: "dispatch", entityId: dispatch.id, metadata: { source: "setup_session", targetInviteHash: TARGET_INVITE_HASH }, modifiedBy: actorId });
      return { id: dispatch.id, status: "queued", repeated: false };
    });
    return reply(result, result.repeated ? 200 : 202);
  } catch (error) {
    if (error instanceof Error && ["product_changed", "review_required", "invalid_offer"].includes(error.message)) return reply({ error: error.message }, 409);
    if (error instanceof Error && error.message === "group_not_bound") return reply({ error: "group_not_bound" }, 409);
    if (error instanceof Error && error.message === "duplicate_24h") return reply({ error: "duplicate_24h" }, 409);
    return reply({ error: "dispatch_unavailable" }, 503);
  }
}
