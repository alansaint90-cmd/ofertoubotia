import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, whatsappGroups, whatsappInstances } from "@/lib/db/schema";
import { setupActor } from "@/lib/db/runtime";
import { hasSetupSession, sameOrigin, setupReady } from "@/lib/evolution/setup";
import { resolveAllowedGroup, TARGET_INVITE_HASH } from "@/lib/evolution/target";
import { readLimitedJson } from "@/lib/http/read-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.strictObject({ link: z.url().max(200) });
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  if (!setupReady() || !hasSetupSession(request)) return reply({ error: "unauthorized" }, 401);
  try {
    const { db, workspaceId } = await setupActor("integrations:manage");
    const [group] = await db.select({ id: whatsappGroups.id, name: whatsappGroups.name, externalGroupId: whatsappGroups.externalGroupId, metadata: whatsappGroups.metadata })
      .from(whatsappGroups).innerJoin(whatsappInstances, eq(whatsappGroups.instanceId, whatsappInstances.id))
      .where(and(eq(whatsappGroups.workspaceId, workspaceId), eq(whatsappGroups.isDeleted, false), eq(whatsappGroups.isActive, true), sql`${whatsappGroups.metadata}->>'inviteHash' = ${TARGET_INVITE_HASH}`, eq(whatsappInstances.instanceName, process.env.EVOLUTION_INSTANCE_NAME!), eq(whatsappInstances.isDeleted, false)))
      .limit(1);
    if (!group || (group.metadata as { inviteHash?: string }).inviteHash !== TARGET_INVITE_HASH) return reply({ group: null });
    return reply({ group: { id: group.id, name: group.name, externalGroupId: group.externalGroupId } });
  } catch { return reply({ error: "group_unavailable" }, 503); }
}

export async function POST(request: Request): Promise<Response> {
  if (!setupReady() || !hasSetupSession(request)) return reply({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "json_required" }, 415);
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > 512) return reply({ error: "invalid_request" }, 413);
  let input: unknown;
  try { input = await readLimitedJson(request, 512); }
  catch (error) { return reply({ error: "invalid_request" }, error instanceof Error && error.message === "too_large" ? 413 : 400); }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return reply({ error: "invalid_request" }, 400);
  let target;
  try { target = await resolveAllowedGroup(parsed.data.link); }
  catch (error) { return reply({ error: error instanceof Error && ["wrong_group", "whatsapp_not_connected", "not_group_member"].includes(error.message) ? error.message : "group_lookup_failed" }, 422); }
  try {
    const { db, workspaceId, actorId } = await setupActor("integrations:manage");
    const group = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}))`);
      let [instance] = await tx.select({ id: whatsappInstances.id }).from(whatsappInstances)
        .where(and(eq(whatsappInstances.workspaceId, workspaceId), eq(whatsappInstances.instanceName, process.env.EVOLUTION_INSTANCE_NAME!), eq(whatsappInstances.isDeleted, false))).limit(1);
      if (!instance) {
        [instance] = await tx.insert(whatsappInstances).values({ workspaceId, instanceName: process.env.EVOLUTION_INSTANCE_NAME!, status: "connected", modifiedBy: actorId }).returning({ id: whatsappInstances.id });
      }
      await tx.update(whatsappGroups).set({ isActive: false, updatedAt: new Date(), modifiedBy: actorId })
        .where(and(eq(whatsappGroups.workspaceId, workspaceId), eq(whatsappGroups.instanceId, instance.id), ne(whatsappGroups.externalGroupId, target.id), eq(whatsappGroups.isDeleted, false)));
      let [existing] = await tx.select({ id: whatsappGroups.id }).from(whatsappGroups)
        .where(and(eq(whatsappGroups.instanceId, instance.id), eq(whatsappGroups.externalGroupId, target.id))).limit(1);
      if (existing) {
        [existing] = await tx.update(whatsappGroups).set({ name: target.subject, isActive: true, isDeleted: false, deletedAt: null, metadata: { inviteHash: TARGET_INVITE_HASH }, updatedAt: new Date(), modifiedBy: actorId })
          .where(eq(whatsappGroups.id, existing.id)).returning({ id: whatsappGroups.id });
      } else {
        [existing] = await tx.insert(whatsappGroups).values({ workspaceId, instanceId: instance.id, externalGroupId: target.id, name: target.subject, metadata: { inviteHash: TARGET_INVITE_HASH }, modifiedBy: actorId }).returning({ id: whatsappGroups.id });
      }
      await tx.insert(auditLogs).values({ workspaceId, actorId, operation: "evolution.group_bind", entityType: "whatsapp_group", entityId: existing.id, metadata: { source: "setup_session", inviteHash: TARGET_INVITE_HASH }, modifiedBy: actorId });
      return { id: existing.id, name: target.subject, externalGroupId: target.id };
    });
    return reply({ group });
  } catch { return reply({ error: "group_save_failed" }, 503); }
}
