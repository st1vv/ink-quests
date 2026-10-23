import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

// Owner-only stats, open to the wallets in ADMIN_ADDRESSES, and the X post
// of the day they set.
@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
