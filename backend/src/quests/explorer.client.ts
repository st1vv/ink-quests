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

// Fields of Blockscout's Etherscan-compatible `tokentx` we rely on: one
// ERC-20 transfer, of `contractAddress`, from `from` to `to`.
export type ExplorerTokenTransfer = {
  hash: Hex;
  from: string;
  to: string;
  contractAddress: string;
  // Raw amount (decimal string) and the token's decimals.
  value: string;
  tokenDecimal: string;
  timeStamp: string;
};

type ListResponse<T> = {
  status: string;
  message: string;
  result: T[] | string | null;
};

// Blockscout's own (v2) API: a token's page, with its USD price from
// CoinGecko. Null when nobody prices it.
type TokenResponse = { exchange_rate: string | null };

const PRICE_CACHE_MS = 60 * 1000;

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
  private readonly prices = new Map<string, { usd: number; at: number }>();

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
    const txs = await this.list<ExplorerTx>({
      action: 'txlist',
      address,
      start_timestamp: String(Math.floor(from.getTime() / 1000)),
      end_timestamp: String(Math.ceil(to.getTime() / 1000)),
    });
    const sender = address.toLowerCase();
    return txs.filter((tx) => tx.from.toLowerCase() === sender);
  }

  // Transfers of `token` that `address` received since `from`, newest
  // first, whoever sent the transaction (a smart wallet's relayed calls
  // included). `tokentx` ignores the timestamp filters, so they're applied
  // here.
  async receivedTokenTransfers(address: string, token: string, from: Date) {
    const transfers = await this.list<ExplorerTokenTransfer>({
      action: 'tokentx',
      address,
      contractaddress: token,
    });
    const receiver = address.toLowerCase();
    const since = from.getTime() / 1000;
    return transfers.filter(
      (t) => t.to.toLowerCase() === receiver && Number(t.timeStamp) >= since,
    );
  }

  // A token's USD price, cached for a minute; throws when it has none.
  async tokenUsdPrice(token: string) {
    const key = token.toLowerCase();
    const hit = this.prices.get(key);
    if (hit && Date.now() - hit.at < PRICE_CACHE_MS) return hit.usd;

    const body = await this.get<TokenResponse>(
      `${this.baseUrl}/v2/tokens/${token}`,
    );
    const usd = Number(body.exchange_rate);
    if (!(usd > 0)) throw new Error(`No USD price for token ${token}`);

    this.prices.set(key, { usd, at: Date.now() });
    return usd;
  }

  private async list<T>(query: Record<string, string>) {
    const params = new URLSearchParams({
      module: 'account',
      sort: 'desc',
      page: '1',
      offset: PAGE_SIZE,
      ...query,
    });
    const body = await this.get<ListResponse<T>>(`${this.baseUrl}?${params}`);
    if (body.status !== '1') {
      if (body.message.startsWith('No ')) return [];
      throw new Error(`Explorer error: ${body.message}`);
    }
    return Array.isArray(body.result) ? body.result : [];
  }

  private async get<T>(url: string) {
    const withKey = new URL(url);
    if (this.apiKey) withKey.searchParams.set('apikey', this.apiKey);

    const res = await fetch(withKey, { signal: AbortSignal.timeout(10_000) });
    if (res.status === 429) {
      throw new Error(
        `Explorer rate limit hit (resets in ${res.headers.get('x-ratelimit-reset')} ms)`,
      );
    }
    if (!res.ok) throw new Error(`Explorer responded with ${res.status}`);
    return (await res.json()) as T;
  }
}
