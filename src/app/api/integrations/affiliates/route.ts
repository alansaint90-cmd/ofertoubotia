import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { affiliateIntegrations, auditLogs } from "@/lib/db/schema";
import { setupActor } from "@/lib/db/runtime";
import { hasSetupSession, sameOrigin, setupReady } from "@/lib/evolution/setup";
import { credentialsEncryptionReady, encryptCredentials } from "@/lib/integrations/credentials";
import { readLimitedJson } from "@/lib/http/read-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const short = z.string().trim().min(1).max(300);
const optional = z.string().trim().max(300).default("");
const httpsUrl = z.url().max(1000).refine(value => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "Use uma URL HTTPS pública.");
const schemas = {
  aliexpress: z.strictObject({ appKey: short, secret: short, trackingId: short }),
  amazon: z.strictObject({ affiliateId: short, accessKey: short, secretKey: short }),
  awin: z.strictObject({ affiliateId: short, apiToken: short }),
  shopee: z.strictObject({ affiliateId: short, apiPassword: optional }),
  magalu: z.strictObject({ storeName: short }),
  mercadolivre: z.strictObject({ affiliateLink: httpsUrl, cookie: z.string().trim().min(1).max(10000) }),
} as const;
type Provider = keyof typeof schemas;
const providerSchema = z.enum(Object.keys(schemas) as [Provider, ...Provider[]]);
const inputSchema = z.strictObject({ provider: providerSchema, credentials: z.record(z.string(), z.unknown()) });
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  if (!setupReady() || !hasSetupSession(request)) return reply({ error: "unauthorized" }, 401);
  try {
    const { db, workspaceId } = await setupActor("integrations:manage");
    const rows = await db.select({ provider: affiliateIntegrations.provider, status: affiliateIntegrations.status, updatedAt: affiliateIntegrations.updatedAt })
      .from(affiliateIntegrations)
      .where(and(eq(affiliateIntegrations.workspaceId, workspaceId), eq(affiliateIntegrations.isDeleted, false)));
    return reply({ integrations: rows, encryptionReady: credentialsEncryptionReady() });
  } catch { return reply({ error: "integrations_unavailable" }, 503); }
}

export async function POST(request: Request): Promise<Response> {
  if (!setupReady() || !hasSetupSession(request)) return reply({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  if (!credentialsEncryptionReady()) return reply({ error: "encryption_not_configured" }, 503);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "json_required" }, 415);
  let input: unknown;
  try { input = await readLimitedJson(request, 16384); }
  catch (error) { return reply({ error: "invalid_request" }, error instanceof Error && error.message === "too_large" ? 413 : 400); }
  const base = inputSchema.safeParse(input);
  if (!base.success) return reply({ error: "invalid_request" }, 400);
  const credentials = schemas[base.data.provider].safeParse(base.data.credentials);
  if (!credentials.success) return reply({ error: "invalid_credentials" }, 400);
  try {
    const { db, workspaceId, actorId } = await setupActor("integrations:manage");
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext(${base.data.provider}))`);
      const [existing] = await tx.select({ id: affiliateIntegrations.id }).from(affiliateIntegrations)
        .where(and(eq(affiliateIntegrations.workspaceId, workspaceId), eq(affiliateIntegrations.provider, base.data.provider), eq(affiliateIntegrations.isDeleted, false))).limit(1);
      const encrypted = encryptCredentials(credentials.data);
      let entityId: string;
      if (existing) {
        entityId = existing.id;
        await tx.update(affiliateIntegrations).set({ credentialsEncrypted: encrypted, status: "configured", metadata: { configuredFields: Object.keys(credentials.data) }, updatedAt: new Date(), modifiedBy: actorId })
          .where(eq(affiliateIntegrations.id, existing.id));
      } else {
        const [created] = await tx.insert(affiliateIntegrations).values({ workspaceId, provider: base.data.provider, status: "configured", credentialsEncrypted: encrypted, metadata: { configuredFields: Object.keys(credentials.data) }, modifiedBy: actorId }).returning({ id: affiliateIntegrations.id });
        entityId = created.id;
      }
      await tx.insert(auditLogs).values({ workspaceId, actorId, operation: "affiliate_integration.configured", entityType: "affiliate_integration", entityId, metadata: { provider: base.data.provider, source: "setup_session" }, modifiedBy: actorId });
    });
    return reply({ provider: base.data.provider, status: "configured" });
  } catch { return reply({ error: "save_failed" }, 503); }
}
