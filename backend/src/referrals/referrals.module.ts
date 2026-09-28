import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

// Invite codes and referral rewards. Sign-up attribution (the ?ref code)
// happens in AuthService; the reward is paid from QuestsService.
@Module({
  imports: [AuthModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
