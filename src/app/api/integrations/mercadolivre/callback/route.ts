import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { affiliateIntegrations, auditLogs } from "@/lib/db/schema";
import { setupActor } from "@/lib/db/runtime";
import { credentialsEncryptionReady, encryptCredentials } from "@/lib/integrations/credentials";
import { exchangeAuthorizationCode, integrationReturnUrl, ML_STATE_COOKIE, verifyOAuthState, type MercadoLivreOAuthError } from "@/lib/integrations/mercadolivre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(result: "conectado" | "erro", reason?: MercadoLivreOAuthError) {
  return Response.redirect(integrationReturnUrl(result, reason), 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  if (url.searchParams.has("error")) return back("erro", "autorizacao_recusada");
  if (!credentialsEncryptionReady()) return back("erro", "configuracao_invalida");
  if (!code || code.length > 2000 || !state || state.length > 2000) return back("erro", "estado_invalido");
  const jar = await cookies();
  let stage: MercadoLivreOAuthError = "estado_invalido";
  try {
    const stateWorkspaceId = verifyOAuthState(state, jar.get(ML_STATE_COOKIE)?.value);
    stage = "workspace_invalido";
    const { db, workspaceId, actorId } = await setupActor("integrations:manage");
    if (workspaceId !== stateWorkspaceId) throw new Error("workspace_mismatch");
    stage = "troca_token_falhou";
    const tokens = await exchangeAuthorizationCode(code);
    stage = "gravacao_falhou";
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext('mercadolivre'))`);
      const [existing] = await tx.select({ id: affiliateIntegrations.id }).from(affiliateIntegrations)
        .where(and(eq(affiliateIntegrations.workspaceId, workspaceId), eq(affiliateIntegrations.provider, "mercadolivre"), eq(affiliateIntegrations.isDeleted, false))).limit(1);
      const credentialsEncrypted = encryptCredentials(tokens);
      const metadata = { configuredFields: ["oauth"], mercadoLivreUserId: tokens.userId, expiresAt: tokens.expiresAt };
      let entityId: string;
      if (existing) {
        entityId = existing.id;
        await tx.update(affiliateIntegrations).set({ credentialsEncrypted, status: "connected", metadata, updatedAt: new Date(), modifiedBy: actorId }).where(eq(affiliateIntegrations.id, existing.id));
      } else {
        const [created] = await tx.insert(affiliateIntegrations).values({ workspaceId, provider: "mercadolivre", status: "connected", credentialsEncrypted, metadata, modifiedBy: actorId }).returning({ id: affiliateIntegrations.id });
        entityId = created.id;
      }
      await tx.insert(auditLogs).values({ workspaceId, actorId, operation: "affiliate_integration.oauth_connected", entityType: "affiliate_integration", entityId, metadata: { provider: "mercadolivre" }, modifiedBy: actorId });
    });
    jar.delete(ML_STATE_COOKIE);
    return back("conectado");
  } catch {
    jar.delete(ML_STATE_COOKIE);
    return back("erro", stage);
  }
}
