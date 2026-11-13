import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Env } from '../config/env';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { telegramLinkTokens, users } from '../database/schema';
import { isInChat } from './bot-messages';
import {
  TelegramApi,
  TelegramApiError,
  type ChatMember,
  type TelegramUser,
} from './telegram.api';

const TOKEN_TTL_MS = 10 * 60 * 1000;

// Why linking failed, for the bot's reply.
export type TelegramLinkError =
  | 'expired' // token unknown or too old
  | 'taken' // this Telegram account is linked to another wallet
  | 'already-linked'; // this wallet has a different Telegram account

export class TelegramLinkFailure extends Error {
  constructor(readonly reason: TelegramLinkError) {
    super(reason);
  }
}

const isUniqueViolation = (err: unknown) =>
  (err as { cause?: { code?: string } }).cause?.code === '23505';

// Links a wallet to its owner's Telegram account and checks membership of
// our group. Linking goes through the bot: the site hands out a one-time
// /start link, and the bot links whoever opens it. Telegram vouches for
// the sender of a message, so there's nothing to sign.
@Injectable()
export class TelegramService {
  private readonly chatId: string;
  private botUsername?: Promise<string>;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly api: TelegramApi,
    config: ConfigService<Env, true>,
  ) {
    this.chatId = config.get('TELEGRAM_CHAT_ID', { infer: true });
  }

  get available() {
    return this.api.available;
  }

  // The bot's @username, asked of Telegram once.
  username() {
    this.botUsername ??= this.api
      .call<TelegramUser>('getMe')
      .then((me) => me.username ?? '')
      .catch((err: unknown) => {
        this.botUsername = undefined;
        throw err;
      });
    return this.botUsername;
  }

  async account(userId: number) {
    const [row] = await this.db
      .select({
        id: users.telegramUserId,
        username: users.telegramUsername,
      })
      .from(users)
      .where(eq(users.id, userId));
    return {
      available: this.available,
      linked: Boolean(row?.id),
      username: row?.username ?? null,
    };
  }

  async telegramIdOf(userId: number) {
    const [row] = await this.db
      .select({ id: users.telegramUserId })
      .from(users)
      .where(eq(users.id, userId));
    return row?.id ?? null;
  }

  // The bot link to open: t.me/<bot>?start=<token>.
  async linkUrl(userId: number) {
    await this.db
      .delete(telegramLinkTokens)
      .where(lt(telegramLinkTokens.expiresAt, new Date()));

    // base64url: within the 64 [A-Za-z0-9_-] a start parameter may have.
    const token = randomBytes(24).toString('base64url');
    await this.db.insert(telegramLinkTokens).values({
      token,
      userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });
    return `https://t.me/${await this.username()}?start=${token}`;
  }

  // Links the wallet behind `token` to the Telegram user who sent it.
  async complete(token: string, from: TelegramUser) {
    // Single use: a second /start with the same token finds nothing.
    const [pending] = await this.db
      .delete(telegramLinkTokens)
      .where(
        and(
          eq(telegramLinkTokens.token, token),
          gt(telegramLinkTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!pending) throw new TelegramLinkFailure('expired');

    const id = String(from.id);
    const [user] = await this.db
      .select({ telegramUserId: users.telegramUserId })
      .from(users)
      .where(eq(users.id, pending.userId));
    // Like X: switching accounts would let one person claim twice.
    if (user?.telegramUserId && user.telegramUserId !== id) {
      throw new TelegramLinkFailure('already-linked');
    }

    try {
      await this.db
        .update(users)
        .set({
          telegramUserId: id,
          telegramUsername: from.username ?? null,
          telegramLinkedAt: new Date(),
        })
        .where(eq(users.id, pending.userId));
    } catch (err) {
      if (isUniqueViolation(err)) throw new TelegramLinkFailure('taken');
      throw err;
    }
  }

  // Whether the Telegram user is in our group right now. Throws when
  // Telegram can't be reached or the bot can't see the group.
  async isMember(telegramUserId: string) {
    try {
      const member = await this.api.call<ChatMember>('getChatMember', {
        chat_id: this.chatId,
        user_id: Number(telegramUserId),
      });
      return isInChat(member);
    } catch (err) {
      // Never been in the group.
      if (
        err instanceof TelegramApiError &&
        err.code === 400 &&
        /user not found|participant_id_invalid/i.test(err.description)
      ) {
        return false;
      }
      throw err;
    }
  }
}
