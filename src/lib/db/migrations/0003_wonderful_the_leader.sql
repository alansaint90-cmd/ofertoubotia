CREATE TABLE "product_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"affiliate_url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"modified_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "product_collection_live_item_idx" ON "product_collection" USING btree ("workspace_id","item_id") WHERE "product_collection"."is_deleted" = false;