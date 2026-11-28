CREATE TABLE "weekly_mission_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"mission_id" integer NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_missions" (
	"id" serial PRIMARY KEY NOT NULL,
	"week" date NOT NULL,
	"slug" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"target" integer NOT NULL,
	"points" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_mission_claims" ADD CONSTRAINT "weekly_mission_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_mission_claims" ADD CONSTRAINT "weekly_mission_claims_mission_id_weekly_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."weekly_missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_mission_claims_user_id_mission_id_index" ON "weekly_mission_claims" USING btree ("user_id","mission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_missions_week_slug_index" ON "weekly_missions" USING btree ("week","slug");