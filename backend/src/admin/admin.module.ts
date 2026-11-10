import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ProfileModule } from '../profile/profile.module';
import { AdminController } from './admin.controller';
import { GrowthService } from './growth.service';
import { StatisticsService } from './statistics.service';
import { XpGrantsService } from './xp-grants.service';

// Owner-only stats, open to the wallets in ADMIN_ADDRESSES, the X post of
// the day they set, XP they give by hand and the growth charts.
@Module({
  imports: [AuthModule, CatalogModule, ProfileModule],
  controllers: [AdminController],
  providers: [GrowthService, StatisticsService, XpGrantsService],
})
export class AdminModule {}
