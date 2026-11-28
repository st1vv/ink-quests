import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { WeeklyService } from './weekly.service';

// { week, resetsAt, missions: { slug, title, description, target, points,
//   progress, claimed }[] }
@Controller()
export class WeeklyController {
  constructor(private readonly weekly: WeeklyService) {}

  // For signed-out visitors: the week's missions with no progress.
  @Get('weekly-missions')
  missions() {
    return this.weekly.missions(null);
  }

  @Get('me/weekly-missions')
  @UseGuards(AuthGuard)
  myMissions(@CurrentUser() user: AuthUser) {
    return this.weekly.missions(user.id);
  }

  // → { slug, title, points }. 422 until the target is reached, 409 on a
  // repeat, 404 for a mission that isn't this week's.
  @Post('me/weekly-missions/:slug/claim')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  claim(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.weekly.claim(user.id, slug);
  }
}
