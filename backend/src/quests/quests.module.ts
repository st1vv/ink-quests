import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExplorerClient } from './explorer.client';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';

// Claiming quests: checks the user's transactions onchain and records
// completions. The public catalog lives in CatalogModule.
@Module({
  imports: [AuthModule],
  controllers: [QuestsController],
  providers: [QuestsService, ExplorerClient],
})
export class QuestsModule {}
