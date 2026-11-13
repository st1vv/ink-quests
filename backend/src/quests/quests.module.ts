import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { TelegramModule } from '../telegram/telegram.module';
import { XModule } from '../x/x.module';
import { ExplorerClient } from './explorer.client';
import { CowClient } from './cow.client';
import { NadoClient } from './nado.client';
import { PriceService } from './price.service';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';
import { RelayClient } from './relay.client';
import { VerificationService } from './verification.service';

// Claiming quests: checks the user's transactions onchain and records
// completions. The public catalog lives in CatalogModule.
@Module({
  imports: [
    AuthModule,
    ReferralsModule,
    CatalogModule,
    XModule,
    TelegramModule,
  ],
  controllers: [QuestsController],
  providers: [
    QuestsService,
    VerificationService,
    ExplorerClient,
    PriceService,
    RelayClient,
    NadoClient,
    CowClient,
  ],
})
export class QuestsModule {}
