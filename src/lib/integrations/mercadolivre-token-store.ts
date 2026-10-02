import { and, eq, sql } from "drizzle-orm";
import { setupActor } from "@/lib/db/runtime";
import { affiliateIntegrations, auditLogs } from "@/lib/db/schema";
import { decryptCredentials, encryptCredentials } from "@/lib/integrations/credentials";
import { refreshMercadoLivreToken } from "@/lib/integrations/mercadolivre";

export async function liveMercadoLivreToken(actor: Awaited<ReturnType<typeof setupActor>>, rejectedToken?: string) {
  const { db, workspaceId, actorId } = actor;
  const claim = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext('mercadolivre'))`);
    const [row] = await tx.select().from(affiliateIntegrations).where(and(eq(affiliateIntegrations.workspaceId, workspaceId), eq(affiliateIntegrations.provider, "mercadolivre"), eq(affiliateIntegrations.isDeleted, false))).limit(1);
    if (row?.status === "refreshing") throw new Error("refresh_busy");
    if (!row?.credentialsEncrypted || row.status !== "connected") throw new Error("reconnect_required");
    const tokens = decryptCredentials(row.credentialsEncrypted);
    if (!tokens.accessToken || !tokens.refreshToken) throw new Error("reconnect_required");
    const renew = !Number.isFinite(Date.parse(tokens.expiresAt)) || Date.parse(tokens.expiresAt) <= Date.now() + 60000 || rejectedToken === tokens.accessToken;
    if (renew) {
      // Persist the claim before consuming the one-use refresh token. A crash requires reconnect.
      await tx.update(affiliateIntegrations).set({ status: "refreshing", updatedAt: new Date(), modifiedBy: actorId }).where(eq(affiliateIntegrations.id, row.id));
      await tx.insert(auditLogs).values({ workspaceId, actorId, operation: "mercadolivre.refresh_started", entityType: "affiliate_integration", entityId: row.id, modifiedBy: actorId });
    }
    return { row, tokens, renew };
  });
  if (!claim.renew) return claim.tokens;
  const owned = and(eq(affiliateIntegrations.id, claim.row.id), eq(affiliateIntegrations.workspaceId, workspaceId), eq(affiliateIntegrations.isDeleted, false), eq(affiliateIntegrations.status, "refreshing"), eq(affiliateIntegrations.credentialsEncrypted, claim.row.credentialsEncrypted!));
  try {
    const fresh = await refreshMercadoLivreToken(claim.tokens.refreshToken);
    if (fresh.userId && fresh.userId !== claim.tokens.userId) throw new Error("reconnect_required");
    const tokens = { ...claim.tokens, ...fresh, userId: fresh.userId ?? claim.tokens.userId };
    await db.transaction(async tx => {
      const rows = await tx.update(affiliateIntegrations).set({ status: "connected", credentialsEncrypted: encryptCredentials(tokens), metadata: { configuredFields: ["oauth"], mercadoLivreUserId: tokens.userId, expiresAt: tokens.expiresAt }, updatedAt: new Date(), modifiedBy: actorId }).where(owned).returning({ id: affiliateIntegrations.id });
      if (!rows.length) throw new Error("reconnect_required");
      await tx.insert(auditLogs).values({ workspaceId, actorId, operation: "mercadolivre.token_refreshed", entityType: "affiliate_integration", entityId: claim.row.id, modifiedBy: actorId });
    });
    return tokens;
  } catch (error) {
    if (error instanceof Error && error.message === "refresh_rate_limited") {
      await db.update(affiliateIntegrations).set({ status: "connected", updatedAt: new Date(), modifiedBy: actorId }).where(owned);
      throw new Error("rate_limited");
    }
    await db.transaction(async tx => {
      const rows = await tx.update(affiliateIntegrations).set({ status: "reconnect_required", updatedAt: new Date(), modifiedBy: actorId }).where(owned).returning({ id: affiliateIntegrations.id });
      if (rows.length) await tx.insert(auditLogs).values({ workspaceId, actorId, operation: "mercadolivre.refresh_failed", entityType: "affiliate_integration", entityId: claim.row.id, modifiedBy: actorId });
    });
    throw new Error("reconnect_required");
  }
}
