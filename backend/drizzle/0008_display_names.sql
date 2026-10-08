ALTER TABLE "users" ADD COLUMN "display_name" varchar(20);--> statement-breakpoint
CREATE UNIQUE INDEX "users_display_name_lower_index" ON "users" USING btree (lower("display_name"));