ALTER TABLE "product_collection" ALTER COLUMN "item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_collection" ADD COLUMN "reference_code" text DEFAULT '' NOT NULL;