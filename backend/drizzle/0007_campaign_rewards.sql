CREATE TABLE "campaign_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "reward_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_rewards_user_id_partner_id_index" ON "campaign_rewards" USING btree ("user_id","partner_id");