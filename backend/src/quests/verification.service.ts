import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { erc721Abi, type Address, type Hex } from 'viem';
import { createInkClient, type InkClient } from '../chain/ink-client';
import type { Env } from '../config/env';
import { ExplorerClient } from './explorer.client';
import { NadoClient } from './nado.client';
import { isActiveStakeOf, MAX_STAKES_CHECKED, nftStakeAbi } from './nft-stake';
import { PriceService } from './price.service';
import { RelayClient } from './relay.client';
import {
  findMatchingTx,
  matchingRelayBridge,
  type NadoPerpVolumeSpec,
  type NftHolderSpec,
  type RelayBridgeSpec,
  type VerifierSpec,
} from './verifiers';

export type Verification =
  // Done; txHash is the matching transaction, null for holding checks.
  | { done: true; txHash: Hex | null }
  // Not done: no matching transaction, no token held, no bridge, or not
  // enough futures volume on Nado.
  | { done: false; missing: 'transaction' | 'nft' | 'bridge' | 'futures' };

// Checks whether a user has done what a quest's verifier asks for. Throws
// when the explorer, the RPC or the oracle can't be reached.
@Injectable()
export class VerificationService {
  private readonly client: InkClient;

  constructor(
    private readonly explorer: ExplorerClient,
    private readonly prices: PriceService,
    private readonly relay: RelayClient,
    private readonly nado: NadoClient,
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
      if (await this.holds(spec, user)) {
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

    const nado = specs.filter(
      (s): s is NadoPerpVolumeSpec => s.type === 'nado-perp-volume',
    );
    if (nado.length) {
      const volume = await this.nado.perpVolume(user, windowStart, now);
      if (nado.some((s) => volume >= s.minUsd)) {
        // Nado's orderbook trades have no transaction of the user's own.
        return { done: true, txHash: null };
      }
    }

    const hasCallSpecs = specs.some(
      (s) =>
        s.type === 'contract-call' ||
        s.type === 'inkyswap-swap' ||
        s.type === 'dex-swap',
    );
    if (!hasCallSpecs) {
      const missing = nado.length
        ? 'futures'
        : bridges.length
          ? 'bridge'
          : 'nft';
      return { done: false, missing };
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
  private async holds(spec: NftHolderSpec, user: Address) {
    const balance = await this.client.readContract({
      address: spec.contract,
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [user],
    });
    if (balance > 0n) return true;

    for (const staking of spec.stakedIn ?? []) {
      if (await this.hasActiveStake(staking, spec.contract, user)) return true;
    }
    return false;
  }

  // Whether `user` has an NFT of `collection` staked in `staking` right
  // now, looking at their newest stakes first.
  private async hasActiveStake(
    staking: Address,
    collection: Address,
    user: Address,
  ) {
    const ids = await this.client.readContract({
      address: staking,
      abi: nftStakeAbi,
      functionName: 'getUserStakeIds',
      args: [user],
    });
    const recent = [...ids].reverse().slice(0, MAX_STAKES_CHECKED);
    const stakes = await Promise.all(
      recent.map((id) =>
        this.client.readContract({
          address: staking,
          abi: nftStakeAbi,
          functionName: 'getStakeInfo',
          args: [id],
        }),
      ),
    );
    return stakes.some((info) => isActiveStakeOf(info, collection, user));
  }
}
