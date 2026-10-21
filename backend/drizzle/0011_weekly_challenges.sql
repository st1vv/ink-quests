CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"places" integer NOT NULL,
	"prize" text NOT NULL,
	"post_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"day" date PRIMARY KEY NOT NULL,
	"post_url" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
