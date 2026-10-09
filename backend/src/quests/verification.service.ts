import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { erc721Abi, type Address, type Hex } from 'viem';
import { createInkClient, type InkClient } from '../chain/ink-client';
import type { Env } from '../config/env';
import { ExplorerClient } from './explorer.client';
import { PriceService } from './price.service';
import { RelayClient } from './relay.client';
import {
  findMatchingTx,
  matchingRelayBridge,
  type NftHolderSpec,
  type RelayBridgeSpec,
  type VerifierSpec,
} from './verifiers';

export type Verification =
  // Done; txHash is the matching transaction, null for holding checks.
  | { done: true; txHash: Hex | null }
  // Not done: no matching transaction, no token held, or no bridge.
  | { done: false; missing: 'transaction' | 'nft' | 'bridge' };

// Checks whether a user has done what a quest's verifier asks for. Throws
// when the explorer, the RPC or the oracle can't be reached.
@Injectable()
export class VerificationService {
  private readonly client: InkClient;

  constructor(
    private readonly explorer: ExplorerClient,
    private readonly prices: PriceService,
    private readonly relay: RelayClient,
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

    const bridges = specs.filter(
      (s): s is RelayBridgeSpec => s.type === 'relay-bridge',
    );
    if (bridges.length) {
      const txHash = await this.findRelayBridge(bridges, user, windowStart);
      if (txHash) return { done: true, txHash };
    }

    const hasCallSpecs = specs.some(
      (s) =>
        s.type === 'contract-call' ||
        s.type === 'inkyswap-swap' ||
        s.type === 'velodrome-swap',
    );
    if (!hasCallSpecs) {
      return { done: false, missing: bridges.length ? 'bridge' : 'nft' };
    }

    const txs = await this.explorer.sentTransactions(user, windowStart, now);
    const tx = await findMatchingTx(specs, txs, (asset) =>
      this.prices.usdPrice(asset),
    );
    return tx
      ? { done: true, txHash: tx.hash }
      : { done: false, missing: 'transaction' };
  }

  // Relay's record says the bridge happened; the Ink transaction it names
  // must also exist and have succeeded, so we don't take the API's word
  // alone.
  private async findRelayBridge(
    specs: RelayBridgeSpec[],
    user: Address,
    since: Date,
  ) {
    const requests = await this.relay.requestsToInk(user, since);
    for (const request of requests) {
      for (const spec of specs) {
        const txHash = matchingRelayBridge(spec, request, user, since);
        if (txHash && (await this.succeededOnInk(txHash))) return txHash;
      }
    }
    return null;
  }

  private async succeededOnInk(hash: Hex) {
    try {
      const receipt = await this.client.getTransactionReceipt({ hash });
      return receipt.status === 'success';
    } catch {
      // Not found (yet): the RPC can lag Relay by a block or two.
      return false;
    }
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
