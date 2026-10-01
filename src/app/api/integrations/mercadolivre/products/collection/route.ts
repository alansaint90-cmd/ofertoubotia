import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { setupActor } from "@/lib/db/runtime";
import { productCollection, auditLogs } from "@/lib/db/schema";
import { decryptCredentials } from "@/lib/integrations/credentials";
import { collectionEntry, parseCollectionLines } from "@/lib/integrations/collection-input";
import { sameOrigin } from "@/lib/evolution/setup";
import { readLimitedJson } from "@/lib/http/read-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function actor() {
  const key = process.env.MERCADO_LIVRE_PRODUCTS_TOKEN?.trim();
  if (!key || key.length < 32) throw new Error("unauthorized");
  let session;
  try { session = decryptCredentials((await cookies()).get("ofertou_ml_products")?.value ?? ""); } catch { throw new Error("unauthorized"); }
  if (session.scope !== "mercadolivre:products:manage" || !(Number(session.expires) > Date.now()) || session.keyVersion !== createHash("sha256").update(key).digest("hex")) throw new Error("unauthorized");
  const owner = await setupActor("offers:write");
  if (session.workspace !== owner.workspaceId || session.actor !== owner.actorId) throw new Error("unauthorized");
  return owner;
}
const fail = (error: unknown) => reply({ error: error instanceof Error && error.message === "unauthorized" ? "Libere novamente o acesso à coleção com a chave de produtos." : "Não foi possível acessar a coleção. Verifique se a migração do banco foi aplicada." }, error instanceof Error && error.message === "unauthorized" ? 401 : 503);
export async function GET() {
  try {
    const { db, workspaceId } = await actor();
    const items = await db.select().from(productCollection).where(and(eq(productCollection.workspaceId, workspaceId), eq(productCollection.isDeleted, false))).orderBy(desc(productCollection.createdAt));
    return reply({ items });
  } catch (error) { return fail(error); }
}
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), entries: z.array(collectionEntry).min(1).max(200) }),
  z.object({ action: z.literal("batch"), text: z.string().min(1).max(450000) }),
  z.object({ action: z.literal("edit"), id: z.uuid(), entry: collectionEntry }),
  z.object({ action: z.literal("toggle"), id: z.uuid(), active: z.boolean() }),
  z.object({ action: z.literal("remove"), id: z.uuid() }),
]);
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Origem recusada." }, 403);
  try {
    const { db, workspaceId, actorId } = await actor();
    const parsed = command.safeParse(await readLimitedJson(request, 500000));
    if (!parsed.success) return reply({ error: parsed.error.issues.map(issue => issue.message).join(" ") }, 400);
    const data = parsed.data;
    const rows = data.action === "batch" ? parseCollectionLines(data.text) : null;
    if (rows && (!rows.length || rows.length > 200 || rows.some(row => !row.data))) return reply({ error: "Revise o lote (máximo de 200 linhas). Nenhuma linha foi salva.", rows }, 400);
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext('product_collection'))`);
      const filter = (id: string) => and(eq(productCollection.id, id), eq(productCollection.workspaceId, workspaceId), eq(productCollection.isDeleted, false));
      const audit = async (id: string, operation: string) => { await tx.insert(auditLogs).values({ workspaceId, actorId, operation, entityType: "product_collection", entityId: id, modifiedBy: actorId }); };
      if (data.action === "add" || data.action === "batch") {
        const entries = data.action === "add" ? data.entries : rows!.map(row => row.data!);
        let added = 0; let skipped = 0;
        for (const entry of entries) {
          const [existing] = await tx.select({ id: productCollection.id }).from(productCollection).where(and(eq(productCollection.workspaceId, workspaceId), eq(productCollection.itemId, entry.itemId), eq(productCollection.isDeleted, false))).limit(1);
          if (existing) { skipped++; continue; }
          const [created] = await tx.insert(productCollection).values({ ...entry, workspaceId, modifiedBy: actorId }).returning({ id: productCollection.id });
          await audit(created.id, "collection.created"); added++;
        }
        return { added, skipped };
      }
      if (data.action === "edit") {
        const [duplicate] = await tx.select({ id: productCollection.id }).from(productCollection).where(and(eq(productCollection.workspaceId, workspaceId), eq(productCollection.itemId, data.entry.itemId), eq(productCollection.isDeleted, false))).limit(1);
        if (duplicate && duplicate.id !== data.id) return { error: "Este anúncio já está na coleção." };
      }
      const [changed] = await tx.update(productCollection).set({ ...(data.action === "edit" ? data.entry : data.action === "toggle" ? { isActive: data.active } : { isDeleted: true, deletedAt: new Date(), isActive: false }), updatedAt: new Date(), modifiedBy: actorId }).where(filter(data.id)).returning({ id: productCollection.id });
      if (!changed) return { error: "Produto não encontrado." };
      await audit(changed.id, `collection.${data.action}`);
      return { updated: true };
    });
    return reply(result, "error" in result ? 409 : 200);
  } catch (error) { return fail(error); }
}
