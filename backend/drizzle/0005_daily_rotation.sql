CREATE TABLE "daily_quest_schedule" (
	"day" date NOT NULL,
	"position" integer NOT NULL,
	"quest_id" integer NOT NULL,
	CONSTRAINT "daily_quest_schedule_day_position_pk" PRIMARY KEY("day","position")
);
--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "min_usd" integer;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "group_key" varchar(64);--> statement-breakpoint
ALTER TABLE "daily_quest_schedule" ADD CONSTRAINT "daily_quest_schedule_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_quest_schedule_day_quest_id_index" ON "daily_quest_schedule" USING btree ("day","quest_id");