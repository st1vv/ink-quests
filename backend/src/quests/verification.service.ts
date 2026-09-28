import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { erc721Abi, type Address, type Hex } from 'viem';
import { createInkClient, type InkClient } from '../chain/ink-client';
import type { Env } from '../config/env';
import { ExplorerClient } from './explorer.client';
import { PriceService } from './price.service';
import {
  findMatchingTx,
  type NftHolderSpec,
  type VerifierSpec,
} from './verifiers';

export type Verification =
  // Done; txHash is the matching transaction, null for holding checks.
  | { done: true; txHash: Hex | null }
  // Not done: no matching transaction, or no token held.
  | { done: false; missing: 'transaction' | 'nft' };

// Checks whether a user has done what a quest's verifier asks for. Throws
// when the explorer, the RPC or the oracle can't be reached.
@Injectable()
export class VerificationService {
  private readonly client: InkClient;

  constructor(
    private readonly explorer: ExplorerClient,
    private readonly prices: PriceService,
    config: ConfigService<Env, true>,
  ) {
    this.client = createInkClient(config.get('INK_RPC_URL', { infer: true }));
  }

  async verify(
    specs: VerifierSpec[],
    user: Address,
    windowStart: Date,
    now: Date,
  ): Promise<Verification> {
    const holdings = specs.filter(
      (s): s is NftHolderSpec => s.type === 'nft-holder',
    );
    for (const spec of holdings) {
      if (await this.holds(spec.contract, user)) {
        return { done: true, txHash: null };
      }
    }

    const hasCallSpecs = specs.some((s) => s.type === 'contract-call');
    if (!hasCallSpecs) return { done: false, missing: 'nft' };

    const txs = await this.explorer.sentTransactions(user, windowStart, now);
    const tx = await findMatchingTx(specs, txs, (asset) =>
      this.prices.usdPrice(asset),
    );
    return tx
      ? { done: true, txHash: tx.hash }
      : { done: false, missing: 'transaction' };
  }

  // Read straight from the chain, so a token bought a second ago counts.
  private async holds(collection: Address, user: Address) {
    const balance = await this.client.readContract({
      address: collection,
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [user],
    });
    return balance > 0n;
  }
}
