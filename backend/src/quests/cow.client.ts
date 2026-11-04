import { Injectable } from '@nestjs/common';

// Fields of CoW Protocol's GET /account/{owner}/orders we rely on. A swap
// on CoW Swap is an order the user signs; a solver settles it through
// GPv2Settlement, so there's no transaction of the user's own (except when
// selling ETH, which goes through the EthFlow contract).
export type CowOrder = {
  uid: string;
  // 'fulfilled' once settled; also 'open', 'cancelled', 'expired', …
  status: string;
  creationDate: string;
  sellToken: string;
  buyToken: string;
  // What was actually swapped, raw amounts (decimal strings).
  executedSellAmount: string;
  executedBuyAmount: string;
};

// CoW Protocol's order book for Ink (the network's name, not its chain id).
const API_URL = 'https://api.cow.fi/ink/api/v1';

// Enough for one wallet's day; more would be a bot.
const PAGE_SIZE = '100';

@Injectable()
export class CowClient {
  // The wallet's orders, newest first. ETH sells are owned by the EthFlow
  // contract but listed here too, under the wallet that placed them.
  async orders(address: string) {
    const params = new URLSearchParams({ limit: PAGE_SIZE });
    const res = await fetch(`${API_URL}/account/${address}/orders?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`CoW API responded with ${res.status}`);
    return (await res.json()) as CowOrder[];
  }
}
