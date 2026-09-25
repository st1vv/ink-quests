import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('quests/daily')
  dailyQuests() {
    return this.catalog.dailyQuests();
  }

  @Get('partners')
  partners() {
    return this.catalog.partners();
  }

  @Get('partners/:slug')
  async partner(@Param('slug') slug: string) {
    const partner = await this.catalog.partner(slug);
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }
}
