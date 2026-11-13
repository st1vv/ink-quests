import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { TelegramApi } from './telegram.api';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

// The Telegram bot: linking Telegram accounts to wallets, checking the
// "join our group" quest, and answering commands in chats.
@Module({
  imports: [AuthModule, CatalogModule, LeaderboardModule],
  controllers: [TelegramController],
  providers: [TelegramApi, TelegramService, TelegramBotService],
  exports: [TelegramService],
})
export class TelegramModule {}
