import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { ReferralsService } from './referrals.service';

@Controller('me')
@UseGuards(AuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  // { code, invited, rewarded, xpEarned, rewardXp }
  @Get('referrals')
  summary(@CurrentUser() user: AuthUser) {
    return this.referrals.summary(user.id);
  }
}
