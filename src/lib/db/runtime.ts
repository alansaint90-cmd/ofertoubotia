import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { z } from "zod";
import { hasPermission } from "@/lib/auth/access";
import { userCredentials, users, workspaceMembers, workspaces } from "@/lib/db/schema";

const globalPool = globalThis as typeof globalThis & { ofertouPool?: pg.Pool };

export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("database_not_configured");
  const pool = globalPool.ofertouPool ?? new pg.Pool({ connectionString: url, max: 5 });
  globalPool.ofertouPool = pool;
  return drizzle(pool);
}

export async function setupActor(permission: "integrations:manage" | "dispatches:publish") {
  const workspaceId = z.uuid().parse(process.env.EVOLUTION_WORKSPACE_ID);
  const db = database();
  const [row] = await db.select({ workspaceId: workspaces.id, ownerId: workspaces.ownerId, role: workspaceMembers.role })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, workspaces.ownerId)))
    .innerJoin(users, eq(users.id, workspaces.ownerId))
    .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.isDeleted, false), eq(workspaceMembers.isDeleted, false), eq(users.isDeleted, false), eq(userCredentials.isDeleted, false), eq(userCredentials.isActive, true)))
    .limit(1);
  if (!row || !hasPermission(row.role, permission)) throw new Error("workspace_access_denied");
  return { db, workspaceId: row.workspaceId, actorId: row.ownerId };
}
