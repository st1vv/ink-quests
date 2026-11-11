import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { QuestsService } from './quests.service';

@Controller()
@UseGuards(AuthGuard)
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get('me/completions')
  async completions(@CurrentUser() user: AuthUser) {
    return { questIds: await this.quests.completedQuestIds(user.id) };
  }

  // Each claim spends explorer API credits. Optional { proofUrl }: the
  // user's X post, which "share your progress" needs.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('quests/:id/claim')
  @HttpCode(200)
  claim(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) questId: number,
    @Body() body: unknown,
  ) {
    const { proofUrl } = (body ?? {}) as { proofUrl?: unknown };
    if (
      proofUrl !== undefined &&
      !(typeof proofUrl === 'string' && proofUrl.length <= 500)
    ) {
      throw new BadRequestException('proofUrl must be a link');
    }
    return this.quests.claim(user, questId, { proofUrl });
  }
}
