import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { ExplorerClient } from './explorer.client';
import { PriceService } from './price.service';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';
import { RelayClient } from './relay.client';
import { VerificationService } from './verification.service';

// Claiming quests: checks the user's transactions onchain and records
// completions. The public catalog lives in CatalogModule.
@Module({
  imports: [AuthModule, ReferralsModule, CatalogModule],
  controllers: [QuestsController],
  providers: [
    QuestsService,
    VerificationService,
    ExplorerClient,
    PriceService,
    RelayClient,
  ],
})
export class QuestsModule {}
