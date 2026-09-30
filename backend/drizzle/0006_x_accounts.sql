CREATE TABLE "x_oauth_states" (
	"state" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_verifier" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "x_user_id" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "x_username" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "x_linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "x_oauth_states" ADD CONSTRAINT "x_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_xUserId_unique" UNIQUE("x_user_id");