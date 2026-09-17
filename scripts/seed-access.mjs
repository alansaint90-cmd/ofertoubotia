import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { z } from "zod";
import { validateNewPassword, hashPassword } from "../src/lib/auth/password.ts";
import { auditLogs, userCredentials, users, workspaceMembers, workspaces } from "../src/lib/db/schema/index.ts";

const seedInput = z.strictObject({
  databaseUrl: z.string().min(1),
  email: z.email().max(254),
  name: z.string().trim().min(2).max(100),
  workspaceName: z.string().trim().min(2).max(100),
  password: z.string(),
});
const secondaryUsersSchema = z.array(z.strictObject({
  email: z.email().max(254),
  name: z.string().trim().min(2).max(100),
  password: z.string(),
  role: z.enum(["admin", "operador", "visualizador"]),
})).max(3);

async function run() {
  const input = seedInput.parse({
    databaseUrl: process.env.DATABASE_URL,
    email: process.env.SEED_OWNER_EMAIL?.trim().toLowerCase(),
    name: process.env.SEED_OWNER_NAME,
    workspaceName: process.env.SEED_WORKSPACE_NAME,
    password: process.env.SEED_OWNER_PASSWORD,
  });
  validateNewPassword(input.password);
  const secondaryUsers = secondaryUsersSchema.parse(JSON.parse(process.env.SEED_ACCESS_USERS?.trim() || "[]"))
    .map(account => ({ ...account, email: account.email.trim().toLowerCase() }));
  const emails = [input.email, ...secondaryUsers.map(account => account.email)];
  if (new Set(emails).size !== emails.length) throw new Error("DUPLICATE_EMAIL");
  for (const account of secondaryUsers) validateNewPassword(account.password);

  const pool = new pg.Pool({ connectionString: input.databaseUrl, max: 2, connectionTimeoutMillis: 10000 });
  try {
    const db = drizzle(pool);
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(20260917, 1)`);

      const [existingOwner] = await tx.select({ id: users.id }).from(users)
        .where(and(eq(users.email, input.email), eq(users.isDeleted, false))).limit(1);
      let ownerId;
      let workspaceId;
      let ownerCreated = false;
      if (existingOwner) {
        const [membership] = await tx.select({ id: workspaceMembers.id, workspaceId: workspaces.id }).from(workspaceMembers)
          .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
          .innerJoin(userCredentials, eq(userCredentials.userId, workspaceMembers.userId))
          .where(and(
            eq(workspaceMembers.userId, existingOwner.id),
            eq(workspaceMembers.role, "owner"),
            eq(workspaceMembers.isDeleted, false),
            eq(workspaces.ownerId, existingOwner.id),
            eq(workspaces.isDeleted, false),
            eq(userCredentials.isDeleted, false),
            eq(userCredentials.isActive, true),
          )).limit(1);
        if (!membership) throw new Error("INCOMPLETE_OWNER");
        ownerId = existingOwner.id;
        workspaceId = membership.workspaceId;
      } else {
        const [anyUser] = await tx.select({ id: users.id }).from(users).limit(1);
        if (anyUser) throw new Error("DATABASE_NOT_EMPTY");
        ownerId = randomUUID();
        workspaceId = randomUUID();
        const passwordHash = await hashPassword(input.password);
        await tx.insert(users).values({ id: ownerId, email: input.email, name: input.name, modifiedBy: ownerId });
        await tx.insert(userCredentials).values({ userId: ownerId, passwordHash, modifiedBy: ownerId });
        await tx.insert(workspaces).values({ id: workspaceId, name: input.workspaceName, ownerId, modifiedBy: ownerId });
        const [membership] = await tx.insert(workspaceMembers)
          .values({ workspaceId, userId: ownerId, role: "owner", modifiedBy: ownerId })
          .returning({ id: workspaceMembers.id });
        await tx.insert(auditLogs).values({
          workspaceId, actorId: ownerId, operation: "access.seed_owner",
          entityType: "workspace_member", entityId: membership.id, modifiedBy: ownerId,
          metadata: { role: "owner", source: "manual_seed" },
        });
        ownerCreated = true;
      }

      let additionalCreated = 0;
      for (const account of secondaryUsers) {
        const [existing] = await tx.select({ id: users.id }).from(users)
          .where(and(eq(users.email, account.email), eq(users.isDeleted, false))).limit(1);
        if (existing) {
          const [membership] = await tx.select({ id: workspaceMembers.id }).from(workspaceMembers)
            .innerJoin(userCredentials, eq(userCredentials.userId, workspaceMembers.userId))
            .where(and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, existing.id),
              eq(workspaceMembers.role, account.role),
              eq(workspaceMembers.isDeleted, false),
              eq(userCredentials.isActive, true),
              eq(userCredentials.isDeleted, false),
            )).limit(1);
          if (!membership) throw new Error("EXISTING_ACCOUNT_CONFLICT");
          continue;
        }
        const userId = randomUUID();
        const passwordHash = await hashPassword(account.password);
        await tx.insert(users).values({ id: userId, email: account.email, name: account.name, modifiedBy: ownerId });
        await tx.insert(userCredentials).values({ userId, passwordHash, modifiedBy: ownerId });
        const [membership] = await tx.insert(workspaceMembers)
          .values({ workspaceId, userId, role: account.role, modifiedBy: ownerId })
          .returning({ id: workspaceMembers.id });
        await tx.insert(auditLogs).values({
          workspaceId, actorId: ownerId, operation: "access.seed_member",
          entityType: "workspace_member", entityId: membership.id, modifiedBy: ownerId,
          metadata: { role: account.role, source: "manual_seed" },
        });
        additionalCreated++;
      }
      return { ownerCreated, additionalCreated, workspaceId };
    });
    console.log(`Seed concluído: dono ${result.ownerCreated ? "criado" : "existente"}; ${result.additionalCreated} conta(s) adicional(is) criada(s). Nenhuma senha existente foi alterada.`);
    console.log(`Workspace ID: ${result.workspaceId}`);
  } finally {
    await pool.end();
  }
}

try {
  await run();
} catch (error) {
  if (error instanceof Error && error.message === "DATABASE_NOT_EMPTY") {
    console.error("Seed recusado: o banco já contém contas. Nenhum acesso foi alterado.");
  } else if (error instanceof Error && error.message === "INCOMPLETE_OWNER") {
    console.error("Seed recusado: a conta já existe, mas o acesso de dono está incompleto.");
  } else if (error instanceof Error && error.message === "EXISTING_ACCOUNT_CONFLICT") {
    console.error("Seed recusado: uma conta já existe com acesso diferente. Nenhuma permissão foi alterada.");
  } else if (error instanceof Error && error.message === "DUPLICATE_EMAIL") {
    console.error("Seed recusado: há e-mails repetidos na configuração.");
  } else if (error instanceof z.ZodError) {
    const labels = {
      databaseUrl: "DATABASE_URL", email: "SEED_OWNER_EMAIL", name: "SEED_OWNER_NAME",
      workspaceName: "SEED_WORKSPACE_NAME", password: "SEED_OWNER_PASSWORD",
    };
    const fields = [...new Set(error.issues.map(issue =>
      labels[issue.path[0]] ?? `SEED_ACCESS_USERS${issue.path.length ? ` (${issue.path.slice(1).join(".")})` : ""}`
    ))];
    console.error(`Variáveis de seed ausentes ou inválidas: ${fields.join(", ")}. Nenhum valor foi exibido.`);
  } else if (error instanceof SyntaxError) {
    console.error("SEED_ACCESS_USERS contém JSON inválido. Use [] para não criar contas adicionais.");
  } else if (error instanceof Error && (error.message.startsWith("A senha") || error.message === "Senha inválida.")) {
    console.error("Senha de seed inválida: use pelo menos 15 caracteres e no máximo 1024 bytes.");
  } else {
    console.error("Não foi possível criar o acesso inicial. Confira a conexão e a migration do banco.");
  }
  process.exitCode = 1;
}
