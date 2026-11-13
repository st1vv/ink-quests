import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogService } from '../catalog/catalog.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import type { Env } from '../config/env';
import {
  BOT_COMMANDS,
  dailyQuestsMessage,
  helpMessage,
  leaderboardMessage,
  linksMessage,
  parseCommand,
} from './bot-messages';
import { TelegramApi, type TelegramUpdate } from './telegram.api';
import { TelegramLinkFailure, TelegramService } from './telegram.service';

// How many places /leaderboard shows.
const TOP_PLAYERS = 10;

const LINK_REPLIES: Record<string, string> = {
  linked:
    'Your Telegram is linked to InkQuests ✅ Go back to the site to verify your quest.',
  expired:
    'This link has expired. Press "Connect Telegram" on the site again to get a new one.',
  taken: 'This Telegram account is already linked to another wallet.',
  'already-linked':
    'That wallet is already linked to a different Telegram account.',
};

// Answers messages sent to the bot (via the webhook): the /start link that
// connects a wallet, and the public commands.
@Injectable()
export class TelegramBotService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly siteUrl: string;
  private readonly webhookUrl?: string;
  private readonly webhookSecret?: string;

  constructor(
    private readonly api: TelegramApi,
    private readonly telegram: TelegramService,
    private readonly catalog: CatalogService,
    private readonly leaderboard: LeaderboardService,
    config: ConfigService<Env, true>,
  ) {
    this.siteUrl = config.get('FRONTEND_ORIGIN', { infer: true });
    this.webhookUrl = config.get('TELEGRAM_WEBHOOK_URL', { infer: true });
    this.webhookSecret = config.get('TELEGRAM_WEBHOOK_SECRET', {
      infer: true,
    });
  }

  // Points Telegram at our webhook and sets the command menu. A failure is
  // logged, not fatal: the rest of the API works without the bot.
  async onApplicationBootstrap() {
    if (!this.api.available || !this.webhookUrl) return;
    try {
      await this.api.call('setWebhook', {
        url: this.webhookUrl,
        secret_token: this.webhookSecret,
        allowed_updates: ['message'],
      });
      await this.api.call('setMyCommands', { commands: BOT_COMMANDS });
    } catch (err) {
      this.logger.warn(`Telegram setup failed: ${(err as Error).message}`);
    }
  }

  isFromTelegram(secret: string | undefined) {
    return Boolean(this.webhookSecret) && secret === this.webhookSecret;
  }

  async handle(update: TelegramUpdate) {
    const message = update.message;
    if (!message?.text || !message.from || message.from.is_bot) return;

    const parsed = parseCommand(message.text, await this.telegram.username());
    if (!parsed) return;
    const chatId = message.chat.id;

    switch (parsed.command) {
      case 'start':
        // A /start with a token links a wallet; deep links only open in a
        // private chat, so a token in a group is ignored.
        if (parsed.arg && message.chat.type === 'private') {
          await this.api.sendMessage(
            chatId,
            await this.link(parsed.arg, message.from),
          );
          return;
        }
        await this.api.sendMessage(chatId, helpMessage());
        return;
      case 'help':
        await this.api.sendMessage(chatId, helpMessage());
        return;
      case 'links':
        await this.api.sendMessage(
          chatId,
          linksMessage([
            { label: 'Website', url: this.siteUrl },
            { label: 'X', url: 'https://x.com/inkquests' },
            { label: 'Telegram', url: 'https://t.me/inkquests' },
          ]),
        );
        return;
      case 'daily_quests': {
        const now = new Date();
        const quests = await this.catalog.dailyQuests(now);
        await this.api.sendMessage(
          chatId,
          dailyQuestsMessage(quests, this.siteUrl, now),
        );
        return;
      }
      case 'leaderboard':
        await this.api.sendMessage(
          chatId,
          leaderboardMessage(
            await this.leaderboard.top(TOP_PLAYERS),
            `${this.siteUrl}/leaderboard`,
          ),
        );
        return;
    }
  }

  private async link(
    token: string,
    from: Parameters<TelegramService['complete']>[1],
  ) {
    try {
      await this.telegram.complete(token, from);
      return LINK_REPLIES.linked;
    } catch (err) {
      if (err instanceof TelegramLinkFailure) return LINK_REPLIES[err.reason];
      throw err;
    }
  }
}
