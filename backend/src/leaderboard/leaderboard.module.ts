import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeaderboardController } from './leaderboard.controller';
import { ChallengeService } from './challenge.service';
import { LeaderboardService } from './leaderboard.service';

// Users ranked by total XP, and the weekly challenge standings.
@Module({
  imports: [AuthModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, ChallengeService],
})
export class LeaderboardModule {}
