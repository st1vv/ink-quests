import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { DailyScheduleService } from './daily-schedule.service';

// Read-only, public quest catalog: today's daily quests and partners.
@Module({
  controllers: [CatalogController],
  providers: [CatalogService, DailyScheduleService],
  // Claims check that a daily quest is on today's schedule.
  exports: [DailyScheduleService],
})
export class CatalogModule {}
