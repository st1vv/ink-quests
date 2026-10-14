import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isAddress } from 'viem';
import { AdminGuard } from './admin.guard';
import {
  STATS_VIEWS,
  StatisticsService,
  type StatsView,
} from './statistics.service';

@Controller('statistics')
@UseGuards(AdminGuard)
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  // { users, usersWithXp, questsCompleted, dailyQuestsCompleted,
  //   partnerQuestsCompleted, checkIns, transactions, transactionUsers }
  @Get()
  stats() {
    return this.statistics.stats();
  }

  // The list behind a stat card (see STATS_VIEWS), e.g. /statistics/users:
  // { total, page, pageSize, items }. Item fields depend on the list.
  @Get(':view')
  list(
    @Param('view') view: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('address') address?: string,
  ) {
    if (!STATS_VIEWS.includes(view as StatsView)) {
      throw new NotFoundException();
    }
    if (page < 1) throw new BadRequestException('page must be 1 or more');
    if (address && !isAddress(address, { strict: false })) {
      throw new BadRequestException('Not an address');
    }
    return this.statistics.list(view as StatsView, page, address);
  }
}
