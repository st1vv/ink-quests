import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { ink } from 'viem/chains';
import type { Env } from '../config/env';

// Tydro's pool; its addresses provider points at the oracle it uses for
// collateral, so the quest minimums use the same prices.
const TYDRO_POOL: Address = '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA';
const CACHE_MS = 60 * 1000;

const createInkClient = (rpcUrl?: string) =>
  createPublicClient({ chain: ink, transport: http(rpcUrl) });

const poolAbi = parseAbi([
  'function ADDRESSES_PROVIDER() view returns (address)',
]);
const providerAbi = parseAbi([
  'function getPriceOracle() view returns (address)',
]);
const oracleAbi = parseAbi([
  'function getAssetPrice(address asset) view returns (uint256)',
]);

// USD prices from Tydro's AaveOracle, scaled by 1e8 (its BASE_CURRENCY_UNIT).
@Injectable()
export class PriceService {
  private readonly client: ReturnType<typeof createInkClient>;
  private oracle: Promise<Address> | null = null;
  private readonly cache = new Map<string, { price: bigint; at: number }>();

  constructor(config: ConfigService<Env, true>) {
    this.client = createInkClient(config.get('INK_RPC_URL', { infer: true }));
  }

  async usdPrice(asset: Address) {
    const key = asset.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.price;

    const price = await this.client.readContract({
      address: await this.oracleAddress(),
      abi: oracleAbi,
      functionName: 'getAssetPrice',
      args: [asset],
    });
    if (price <= 0n) throw new Error(`No oracle price for ${asset}`);

    this.cache.set(key, { price, at: Date.now() });
    return price;
  }

  // Resolved once: the oracle only changes by Tydro governance.
  private oracleAddress() {
    this.oracle ??= (async () => {
      const provider = await this.client.readContract({
        address: TYDRO_POOL,
        abi: poolAbi,
        functionName: 'ADDRESSES_PROVIDER',
      });
      return this.client.readContract({
        address: provider,
        abi: providerAbi,
        functionName: 'getPriceOracle',
      });
    })().catch((err) => {
      // Don't keep a failed lookup around; retry on the next claim.
      this.oracle = null;
      throw err;
    });
    return this.oracle;
  }
}
