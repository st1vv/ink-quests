import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { ProfileService } from './profile.service';

@Controller('me')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  // { joinedAt, checkIns, questsCompleted, bestStreak }
  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.profile.stats(user.id);
  }

  // The latest XP-earning actions: { type, title, points, bonusPoints, at, txHash }[]
  @Get('activity')
  activity(@CurrentUser() user: AuthUser) {
    return this.profile.activity(user.id);
  }
}
