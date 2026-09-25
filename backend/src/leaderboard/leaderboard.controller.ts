import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { LeaderboardService } from './leaderboard.service';

@Controller()
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  // Public: the top users by total XP.
  @Get('leaderboard')
  top() {
    return this.leaderboard.top();
  }

  // The signed-in user's place, also when they're outside the top list.
  @Get('me/rank')
  @UseGuards(AuthGuard)
  rank(@CurrentUser() user: AuthUser) {
    return this.leaderboard.rankOf(user.id);
  }
}
