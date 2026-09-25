import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { ProgressService } from './progress.service';

@Controller('me')
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  // { totalXp, level, levelXp, nextLevelXp, streak, checkedInToday };
  // levelXp and nextLevelXp are the total XP at which the current and next
  // level start.
  @Get('progress')
  get(@CurrentUser() user: AuthUser) {
    return this.progress.progress(user.id);
  }

  // Once per UTC day; 409 on a repeat.
  @Post('check-in')
  @HttpCode(200)
  checkIn(@CurrentUser() user: AuthUser) {
    return this.progress.checkIn(user.id);
  }
}
