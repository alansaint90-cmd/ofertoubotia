ALTER TABLE "dispatches" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_request_id_unique" UNIQUE("request_id");