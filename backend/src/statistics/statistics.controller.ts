import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isAddress } from 'viem';
import { AdminGuard } from './admin.guard';
import { StatisticsService } from './statistics.service';

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

  // { total, page, pageSize, items: { id, address, quest, kind, partner,
  //   points, txHash, completedAt }[] }
  @Get('transactions')
  transactions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('address') address?: string,
  ) {
    if (page < 1) throw new BadRequestException('page must be 1 or more');
    if (address && !isAddress(address, { strict: false })) {
      throw new BadRequestException('Not an address');
    }
    return this.statistics.transactions(page, address);
  }
}
