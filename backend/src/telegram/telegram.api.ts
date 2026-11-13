import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

// An error Telegram answered with (ok: false), e.g. 400 "user not found".
export class TelegramApiError extends Error {
  constructor(
    readonly code: number,
    readonly description: string,
  ) {
    super(`Telegram ${code}: ${description}`);
  }
}

// The parts of a Telegram user we use.
export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

// The parts of an update we use: plain messages.
export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: TelegramUser;
    chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
    text?: string;
  };
};

// A user's place in a chat (getChatMember).
export type ChatMember = {
  status:
    | 'creator'
    | 'administrator'
    | 'member'
    | 'restricted'
    | 'left'
    | 'kicked';
  // Only on 'restricted': whether they're still in the chat.
  is_member?: boolean;
};

// Thin client for the Bot API (core.telegram.org/bots/api). Throws on
// network errors and TelegramApiError on Telegram's own.
@Injectable()
export class TelegramApi {
  private readonly token?: string;
  readonly available: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.available = Boolean(this.token);
  }

  async call<T>(method: string, params: Record<string, unknown> = {}) {
    if (!this.token) throw new Error('No TELEGRAM_BOT_TOKEN');
    const res = await fetch(
      `https://api.telegram.org/bot${this.token}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: T;
      error_code?: number;
      description?: string;
    } | null;
    if (!body?.ok) {
      throw new TelegramApiError(
        body?.error_code ?? res.status,
        body?.description ?? res.statusText,
      );
    }
    return body.result as T;
  }

  sendMessage(chatId: number, text: string) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  }
}
