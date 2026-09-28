import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Hex } from 'viem';
import { ink } from 'viem/chains';
import type { Env } from '../config/env';

// Fields of Blockscout's Etherscan-compatible `txlist` we rely on.
export type ExplorerTx = {
  hash: Hex;
  from: string;
  to: string;
  methodId: string;
  // Calldata: selector + ABI-encoded arguments.
  input: string;
  // ETH sent with the transaction, in wei (decimal string).
  value: string;
  isError: string;
  timeStamp: string;
};

type TxListResponse = {
  status: string;
  message: string;
  result: ExplorerTx[] | string | null;
};

// One page is plenty for a single user's day; anything beyond it would be
// a bot, and missing a match there only means the claim has to wait.
const PAGE_SIZE = '1000';

// Both serve the same Etherscan-compatible API. The PRO one needs a key
// (402 without it) and allows 5 requests/s; the public explorer takes no
// key but rate-limits an IP after ~10 requests.
const PRO_API_URL = `https://api.blockscout.com/${ink.id}/api`;
const PUBLIC_API_URL = 'https://explorer.inkonchain.com/api';

@Injectable()
export class ExplorerClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('EXPLORER_API_KEY', { infer: true });
    this.baseUrl =
      config.get('EXPLORER_API_URL', { infer: true }) ??
      (this.apiKey ? PRO_API_URL : PUBLIC_API_URL);
  }

  // Transactions sent by `address` between `from` and `to`, newest first.
  // Only direct sends: a smart wallet's calls relayed by a bundler show up
  // with the bundler as sender and aren't found here.
  async sentTransactions(address: string, from: Date, to: Date) {
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address,
      sort: 'desc',
      page: '1',
      offset: PAGE_SIZE,
      start_timestamp: String(Math.floor(from.getTime() / 1000)),
      end_timestamp: String(Math.ceil(to.getTime() / 1000)),
    });
    if (this.apiKey) params.set('apikey', this.apiKey);

    const res = await fetch(`${this.baseUrl}?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 429) {
      throw new Error(
        `Explorer rate limit hit (resets in ${res.headers.get('x-ratelimit-reset')} ms)`,
      );
    }
    if (!res.ok) throw new Error(`Explorer responded with ${res.status}`);

    const body = (await res.json()) as TxListResponse;
    if (body.status !== '1') {
      if (body.message === 'No transactions found') return [];
      throw new Error(`Explorer error: ${body.message}`);
    }
    if (!Array.isArray(body.result)) return [];

    const sender = address.toLowerCase();
    return body.result.filter((tx) => tx.from.toLowerCase() === sender);
  }
}
