import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

// Owner-only stats, open to the wallets in ADMIN_ADDRESSES.
@Module({
  imports: [AuthModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
