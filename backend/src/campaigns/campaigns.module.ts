import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

// Campaign rewards: XP for finishing all of a partner's tasks. The tasks
// are verified through the regular quest claim (QuestsModule).
@Module({
  imports: [AuthModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
