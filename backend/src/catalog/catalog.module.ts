import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { DailyScheduleService } from './daily-schedule.service';
import { SocialPostsService } from './social-posts.service';

// Read-only, public quest catalog: today's daily quests and partners.
@Module({
  controllers: [CatalogController],
  providers: [CatalogService, DailyScheduleService, SocialPostsService],
  // Claims check that a daily quest is on today's schedule (or, for the
  // "like & repost" quest, that today has a post); admins set the posts.
  exports: [DailyScheduleService, SocialPostsService],
})
export class CatalogModule {}
