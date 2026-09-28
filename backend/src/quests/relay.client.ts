import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ink } from 'viem/chains';
import type { Env } from '../config/env';

// Fields of Relay's GET /requests/v2 we rely on (one request = one bridge
// or swap).
export type RelayRequest = {
  id: string;
  // 'success' once the funds arrived; also 'pending', 'failure', 'refund'.
  status: string;
  user: string;
  recipient: string | null;
  createdAt: string;
  data?: {
    inTxs?: { chainId: number; hash: string }[];
    outTxs?: { chainId: number; hash: string }[];
    metadata?: {
      currencyIn?: { amountUsd?: string };
    };
  };
};

// Enough for one wallet's day; more would be a bot.
const PAGE_SIZE = '50';

@Injectable()
export class RelayClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('RELAY_API_URL', { infer: true });
  }

  // Relay requests to Ink since `from` that involve `address`. The `user`
  // filter matches the sender and also the recipient, so the caller still
  // has to check who received the funds.
  async requestsToInk(address: string, from: Date) {
    const params = new URLSearchParams({
      user: address,
      destinationChainId: String(ink.id),
      startTimestamp: String(Math.floor(from.getTime() / 1000)),
      limit: PAGE_SIZE,
    });
    const res = await fetch(`${this.baseUrl}/requests/v2?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Relay API responded with ${res.status}`);

    const body = (await res.json()) as { requests?: RelayRequest[] };
    return body.requests ?? [];
  }
}
