CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_hour" integer DEFAULT 8 NOT NULL,
	"end_hour" integer DEFAULT 22 NOT NULL,
	"interval_minutes" integer DEFAULT 10 NOT NULL,
	"review_hours" integer DEFAULT 24 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_workspace_idx" ON "campaigns" USING btree ("workspace_id");