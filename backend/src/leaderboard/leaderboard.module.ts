import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

// Users ranked by total XP (quest completions + check-ins).
@Module({
  imports: [AuthModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
