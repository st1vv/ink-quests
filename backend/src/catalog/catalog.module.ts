import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

// Read-only, public quest catalog: daily quests and partners.
@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
