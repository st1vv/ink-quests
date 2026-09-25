import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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

  @Post('quests/:id/claim')
  @HttpCode(200)
  claim(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) questId: number,
  ) {
    return this.quests.claim(user, questId);
  }
}
