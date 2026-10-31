import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { ChallengeService } from './challenge.service';
import { LeaderboardService } from './leaderboard.service';

@Controller()
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly challenges: ChallengeService,
  ) {}

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

  // Public: the current (or last, or next) challenge and its top
  // players: { challenge: { slug, title, startsAt, endsAt, status, places,
  // prize, postUrl, referralLimit, xRequired } | null, top: { rank,
  // address, name, score }[] }.
  @Get('challenge')
  challenge() {
    return this.challenges.overview();
  }

  // The signed-in user in that challenge: { rank, name, score, eligible,
  // xLinked, referralsCounted }, or null when there's no challenge.
  @Get('me/challenge')
  @UseGuards(AuthGuard)
  myChallenge(@CurrentUser() user: AuthUser) {
    return this.challenges.mine(user.id);
  }
}
