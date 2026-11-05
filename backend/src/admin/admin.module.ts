import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminController } from './admin.controller';
import { StatisticsService } from './statistics.service';
import { XpGrantsService } from './xp-grants.service';

// Owner-only stats, open to the wallets in ADMIN_ADDRESSES, the X post of
// the day they set, and XP they give by hand.
@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [AdminController],
  providers: [StatisticsService, XpGrantsService],
})
export class AdminModule {}
