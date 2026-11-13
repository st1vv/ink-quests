import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import type { TelegramUpdate } from './telegram.api';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramService } from './telegram.service';

@Controller()
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly bot: TelegramBotService,
  ) {}

  // { available, linked, username }: whether the bot is set up, and the
  // linked account (username is null for accounts without one).
  @Get('me/telegram')
  @UseGuards(AuthGuard)
  account(@CurrentUser() user: AuthUser) {
    return this.telegram.account(user.id);
  }

  // { url }: the bot's /start link that links this wallet when opened.
  @Post('me/telegram/link')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async link(@CurrentUser() user: AuthUser) {
    if (!this.telegram.available) {
      throw new ServiceUnavailableException(
        "Connecting Telegram isn't available right now",
      );
    }
    try {
      return { url: await this.telegram.linkUrl(user.id) };
    } catch (err) {
      this.logger.warn(`Telegram link failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        "Couldn't reach Telegram right now, try again in a moment",
      );
    }
  }

  // Telegram posts every message for the bot here. All updates come from
  // Telegram's few IPs, so the per-IP limit would cut a busy group off.
  @Post('telegram/webhook')
  @SkipThrottle()
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    if (!this.bot.isFromTelegram(secret)) throw new ForbiddenException();
    // Always 200: a failed update would otherwise be resent over and over.
    try {
      await this.bot.handle(update);
    } catch (err) {
      this.logger.warn(`Telegram update failed: ${(err as Error).message}`);
    }
    return {};
  }
}
