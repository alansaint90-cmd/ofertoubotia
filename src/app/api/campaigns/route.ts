import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { setupActor } from "@/lib/db/runtime";
import { campaigns, productCollection, auditLogs } from "@/lib/db/schema";
import { sameOrigin } from "@/lib/evolution/setup";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations/credentials";
import { readLimitedJson } from "@/lib/http/read-json";
const digest = (s: string) => createHash("sha256").update(s).digest();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("unlock"), token: z.string().min(32).max(256) }),
  z.object({ action: z.literal("load") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("save"), productIds: z.array(z.uuid()).min(1).max(200), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24), intervalMinutes: z.union([z.literal(5), z.literal(10)]), reviewHours: z.number().int().min(1).max(24), active: z.boolean(), confirmed: z.literal(true) }),
]);
export async function POST(request: Request) {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return reply({ error: "Origem recusada." }, 403);
  try {
    const data = input.parse(await readLimitedJson(request, 20000));
    const key = process.env.CAMPAIGN_ACCESS_TOKEN?.trim();
    if (!key || key.length < 32) return reply({ error: "Configure CAMPAIGN_ACCESS_TOKEN com pelo menos 32 caracteres no Ofertou." }, 503);
    const jar = await cookies();
    const owner = await setupActor("dispatches:publish");
    if (data.action === "unlock") {
      if (!timingSafeEqual(digest(key), digest(data.token))) return reply({ error: "Chave inválida." }, 401);
      jar.set("ofertou_campaign", encryptCredentials({ scope: "campaign", workspace: owner.workspaceId, actor: owner.actorId, key: digest(key).toString("hex"), expires: String(Date.now()+3600000) }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/campaigns", maxAge: 3600 });
      return reply({ unlocked: true });
    }
    let session; try { session = decryptCredentials(jar.get("ofertou_campaign")?.value ?? ""); } catch { return reply({ error: "Libere o acesso à campanha." }, 401); }
    if (session.scope !== "campaign" || session.workspace !== owner.workspaceId || session.actor !== owner.actorId || session.key !== digest(key).toString("hex") || !Number.isFinite(Number(session.expires)) || Number(session.expires) <= Date.now()) return reply({ error: "Acesso expirado." }, 401);
    const { db, workspaceId, actorId } = owner;
    if (data.action === "pause") {
      await db.transaction(async tx => {
        const [row] = await tx.update(campaigns).set({ active: false, updatedAt: new Date(), modifiedBy: actorId }).where(and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.isDeleted, false))).returning();
        if(row) await tx.insert(auditLogs).values({workspaceId,actorId,operation:"campaign.paused",entityType:"campaign",entityId:row.id,modifiedBy:actorId});
      });
    }
    const products = await db.select().from(productCollection).where(and(eq(productCollection.workspaceId, workspaceId), eq(productCollection.isDeleted, false)));
    if (data.action === "save") {
      if (data.startHour >= data.endHour || new Set(data.productIds).size !== data.productIds.length || data.productIds.some(id => !products.some(p => p.id === id))) return reply({ error: "Revise os horários e produtos." }, 400);
      await db.transaction(async tx => {
        const values = { productIds: data.productIds, startHour: data.startHour, endHour: data.endHour, intervalMinutes: data.intervalMinutes, reviewHours: data.reviewHours, active: data.active, modifiedBy: actorId, updatedAt: new Date() };
        const [row] = await tx.insert(campaigns).values({ ...values, workspaceId }).onConflictDoUpdate({ target: campaigns.workspaceId, set: values }).returning();
        await tx.insert(auditLogs).values({ workspaceId, actorId, operation: data.active ? "campaign.activated" : "campaign.paused", entityType: "campaign", entityId: row.id, modifiedBy: actorId });
      });
    }
    const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.isDeleted, false)));
    return reply({ campaign: campaign ?? null, products });
  } catch { return reply({ error: "Não foi possível acessar a campanha. Confira os dados e a migração do banco." }, 400); }
}
