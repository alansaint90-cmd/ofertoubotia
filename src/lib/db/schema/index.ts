import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

const audit = () => ({
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  modifiedBy: uuid("modified_by").references((): AnyPgColumn => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
});

export const userCredentials = pgTable("user_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true, precision: 3 }),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [
  uniqueIndex("user_credentials_user_idx").on(table.userId),
  check("user_credentials_failed_attempts_check", sql`${table.failedAttempts} >= 0`),
]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  sendIntervalSeconds: integer("send_interval_seconds").notNull().default(60),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  role: text("role").notNull().default("visualizador"),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [
  uniqueIndex("workspace_members_workspace_user_idx").on(table.workspaceId, table.userId),
  check("workspace_members_role_check", sql`${table.role} in ('owner', 'admin', 'operador', 'visualizador')`),
]);

export const affiliateIntegrations = pgTable("affiliate_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("disconnected"),
  credentialsEncrypted: text("credentials_encrypted"),
  metadata: jsonb("metadata").notNull().default({}),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [index("affiliate_integrations_workspace_idx").on(table.workspaceId)]);

export const affiliateLinks = pgTable("affiliate_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  provider: text("provider").notNull(),
  externalProductId: text("external_product_id").notNull(),
  originalUrl: text("original_url").notNull(),
  affiliateUrl: text("affiliate_url").notNull(),
  campaign: text("campaign"),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [index("affiliate_links_workspace_product_idx").on(table.workspaceId, table.externalProductId)]);

export const whatsappInstances = pgTable("whatsapp_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  provider: text("provider").notNull().default("evolution"),
  instanceName: text("instance_name").notNull(),
  status: text("status").notNull().default("disconnected"),
  phoneNumber: text("phone_number"),
  metadata: jsonb("metadata").notNull().default({}),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [index("whatsapp_instances_workspace_idx").on(table.workspaceId)]);

export const whatsappGroups = pgTable("whatsapp_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  instanceId: uuid("instance_id").notNull().references(() => whatsappInstances.id, { onDelete: "restrict", onUpdate: "restrict" }),
  externalGroupId: text("external_group_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Geral"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").notNull().default({}),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [uniqueIndex("whatsapp_groups_instance_external_idx").on(table.instanceId, table.externalGroupId)]);

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  affiliateLinkId: uuid("affiliate_link_id").references(() => affiliateLinks.id, { onDelete: "restrict", onUpdate: "restrict" }),
  provider: text("provider").notNull(),
  externalProductId: text("external_product_id").notNull(),
  productSnapshot: jsonb("product_snapshot").notNull(),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  coupon: text("coupon"),
  status: text("status").notNull().default("draft"),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [index("offers_workspace_created_idx").on(table.workspaceId, table.createdAt)]);

export const scheduledPublications = pgTable("scheduled_publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "restrict", onUpdate: "restrict" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, precision: 3 }).notNull(),
  status: text("status").notNull().default("pending"),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [index("scheduled_publications_due_idx").on(table.status, table.scheduledAt)]);

export const dispatches = pgTable("dispatches", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "restrict", onUpdate: "restrict" }),
  groupId: uuid("group_id").notNull().references(() => whatsappGroups.id, { onDelete: "restrict", onUpdate: "restrict" }),
  scheduledPublicationId: uuid("scheduled_publication_id").references(() => scheduledPublications.id, { onDelete: "restrict", onUpdate: "restrict" }),
  status: text("status").notNull().default("queued"),
  queuedAt: timestamp("queued_at", { withTimezone: true, precision: 3 }),
  sentAt: timestamp("sent_at", { withTimezone: true, precision: 3 }),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  externalMessageId: text("external_message_id"),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [index("dispatches_workspace_group_idx").on(table.workspaceId, table.groupId, table.createdAt)]);

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  offerId: uuid("offer_id").references(() => offers.id, { onDelete: "restrict", onUpdate: "restrict" }),
  provider: text("provider").notNull(),
  promptVersion: text("prompt_version").notNull(),
  output: text("output").notNull(),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "restrict", onUpdate: "restrict" }),
  actorId: uuid("actor_id").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  operation: text("operation").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  modifiedBy: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  ...audit(),
}, table => [index("audit_logs_workspace_created_idx").on(table.workspaceId, table.createdAt)]);
