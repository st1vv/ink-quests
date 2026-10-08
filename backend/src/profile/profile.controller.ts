import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { displayNameBody } from './display-name';
import { ProfileService } from './profile.service';

@Controller('me')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  // { joinedAt, displayName, questsCompleted }
  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.profile.stats(user.id);
  }

  // { name } sets the name shown on the leaderboard; an empty one clears it.
  // → { displayName }
  @Put('name')
  setName(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = displayNameBody.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(
        input.error.issues[0]?.message ?? 'Invalid name',
      );
    }
    return this.profile.setDisplayName(user.id, input.data.name);
  }

  // The latest XP-earning actions: { type, title, points, bonusPoints, at, txHash }[]
  @Get('activity')
  activity(@CurrentUser() user: AuthUser) {
    return this.profile.activity(user.id);
  }
}
