import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

// The signed-in user's XP, level and streak, derived from completions.
@Module({
  imports: [AuthModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
