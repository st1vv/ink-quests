import type { Address, Hex } from 'viem';
import { ink } from 'viem/chains';
import type { ExplorerTx } from './explorer.client';
import type { RelayRequest } from './relay.client';

// A minimum USD value the transaction has to move.
export type MinUsd = {
  usd: number;
  // The asset the amount is in, and its decimals.
  asset: Address;
  decimals: number;
  // Where the amount is: the ETH sent with the transaction, or supply()'s
  // second argument.
  amountFrom: 'value' | 'secondArg';
  // Stablecoins count at exactly $1, so supplying 1 USDT passes even when
  // the oracle says $0.9997. Other assets use Tydro's oracle price.
  pegged?: boolean;
};

// One way of completing a quest: a successful transaction the user sent to
// one of `contracts` during the quest's window (today for daily quests,
// since the quest was added for partner quests).
export type ContractCallSpec = {
  type: 'contract-call';
  contracts: Address[];
  // Optional 4-byte selectors the transaction must call, e.g. only swaps
  // on a router that also handles liquidity.
  methods?: Hex[];
  // Optional address the first ABI-encoded argument must equal, e.g. the
  // asset of a lending pool's supply(asset, ...).
  firstArg?: Address;
  minUsd?: MinUsd;
};

// Holding at least one token of an ERC-721 collection at claim time, read
// with balanceOf over RPC. No transaction is involved.
export type NftHolderSpec = {
  type: 'nft-holder';
  contract: Address;
};

// A successful Relay bridge to Ink, received by the user's wallet, from one
// of `fromChains`, worth at least `minUsd` (Relay's USD value of what was
// sent), made during the quest's window.
export type RelayBridgeSpec = {
  type: 'relay-bridge';
  fromChains: number[];
  minUsd: number;
};

export type VerifierSpec = ContractCallSpec | NftHolderSpec | RelayBridgeSpec;

// USD price of an asset, scaled by 1e8 (the Aave oracle's base unit).
export type PriceOf = (asset: Address) => Promise<bigint>;
export const USD_PRICE_UNIT = 10n ** 8n;

const WETH: Address = '0x4200000000000000000000000000000000000006';
const USDT0: Address = '0x0200C29006150606B650577BBE7B6248F58470c1';
const MIN_QUEST_USD = 1;

// Tydro (Aave V3 on Ink). The pool takes any listed asset, so each supply
// quest pins the asset as supply()'s first argument.
const TYDRO_POOL = '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA'; // Pool proxy
const tydroSupply = (
  asset: Address,
  minUsd: Omit<MinUsd, 'asset' | 'amountFrom'>,
): ContractCallSpec => ({
  type: 'contract-call',
  contracts: [TYDRO_POOL],
  methods: ['0x617ba037'], // supply(address,uint256,address,uint16)
  firstArg: asset,
  minUsd: { ...minUsd, asset, amountFrom: 'secondArg' },
});

// Quests point at these by key (`verifier` in seed.ts); a quest is done when
// any of its specs matches. Take addresses only from the protocol's
// official docs or from onchain wiring (e.g. a gateway's constructor
// arguments): anyone can deploy a contract named after a project, so
// explorer search results alone are not a source.
export const VERIFIERS: Record<string, VerifierSpec[]> = {
  // gm.inkonchain.com: ERC1967 proxy, implementation GMV2. Only a plain GM
  // from the wallet itself counts, not GMs sent to someone else or relayed
  // by an agent. Re-check the selectors if the proxy is upgraded.
  'ink-gm': [
    {
      type: 'contract-call',
      contracts: ['0x14Aec24CE62258FECDe22E928D8F37dD47165d4F'],
      methods: [
        '0xc0129d43', // gm()
        '0x50915b89', // gmPlus()
      ],
    },
  ],

  // Supplying at least $1 of WETH, either way, counts:
  'tydro-supply-weth': [
    // WETH the token.
    tydroSupply(WETH, { usd: MIN_QUEST_USD, decimals: 18 }),
    // Native ETH through WrappedTokenGatewayV3, which wraps it and supplies
    // WETH. Its constructor args name the Tydro pool and WETH.
    {
      type: 'contract-call',
      contracts: ['0xDe090EfCD6ef4b86792e2D84E55a5fa8d49D25D2'], // gateway
      methods: ['0x474cf53d'], // depositETH(address,address,uint16)
      minUsd: {
        usd: MIN_QUEST_USD,
        asset: WETH,
        decimals: 18,
        amountFrom: 'value',
      },
    },
  ],

  // USD₮0 (6 decimals), listed in the pool's getReservesList(). ERC-20
  // only: there's no gateway for it.
  'tydro-supply-usdt': [
    tydroSupply(USDT0, { usd: MIN_QUEST_USD, decimals: 6, pegged: true }),
  ],

  // NFT holder dailies: ERC-721 collections on Ink (name/symbol/supply and
  // supportsInterface(0x80ac58cd) checked onchain). Only balanceOf counts,
  // so one NFT moved between wallets can be claimed by each of them.
  // Bridge to Ink with Relay (relay.link) from Ethereum, Base, Arbitrum or
  // Robinhood Chain; chain ids as listed by Relay's GET /chains.
  'relay-bridge-to-ink': [
    {
      type: 'relay-bridge',
      fromChains: [
        1, // Ethereum
        8453, // Base
        42161, // Arbitrum
        4663, // Robinhood Chain
      ],
      minUsd: MIN_QUEST_USD,
    },
  ],

  'hold-templars-of-the-storm': [
    {
      type: 'nft-holder',
      contract: '0x46625E7de9894D83fca49E79cB53B5C25550cE99',
    },
  ],
  'hold-rekt-ink': [
    {
      type: 'nft-holder',
      contract: '0x25Aa78Ab6785A4b0aeFF5c170998992Fd958d43d',
    },
  ],
  'hold-ink-bunnies': [
    {
      type: 'nft-holder',
      contract: '0x4443970B315d3c08C2f962fe00770c52396AFDb7',
    },
  ],
};

// The n-th (0-based) 32-byte ABI word after the selector, or null.
const argWord = (input: string, n: number) => {
  const start = 10 + n * 64;
  return input.length >= start + 64 ? input.slice(start, start + 64) : null;
};

const firstArgAddress = (input: string) => {
  const word = argWord(input, 0);
  return word ? `0x${word.slice(24)}` : null;
};

// Contract, method and first argument: everything that needs no price.
const matchesCall = (spec: ContractCallSpec, tx: ExplorerTx) => {
  const to = tx.to.toLowerCase();
  const method = tx.methodId.toLowerCase();
  return (
    tx.isError === '0' &&
    spec.contracts.some((c) => c.toLowerCase() === to) &&
    (!spec.methods || spec.methods.some((m) => m.toLowerCase() === method)) &&
    (!spec.firstArg ||
      firstArgAddress(tx.input.toLowerCase()) === spec.firstArg.toLowerCase())
  );
};

const txAmount = (min: MinUsd, tx: ExplorerTx) => {
  if (min.amountFrom === 'value') return BigInt(tx.value || '0');
  const word = argWord(tx.input, 1);
  return word ? BigInt(`0x${word}`) : 0n;
};

const meetsMinimum = async (min: MinUsd, tx: ExplorerTx, priceOf: PriceOf) => {
  const price = min.pegged ? USD_PRICE_UNIT : await priceOf(min.asset);
  // amount / 10^decimals * price / 1e8 >= usd, in integers (cents).
  const cents = BigInt(Math.round(min.usd * 100));
  return (
    txAmount(min, tx) * price * 100n >=
    cents * 10n ** BigInt(min.decimals) * USD_PRICE_UNIT
  );
};

// The first transaction (newest first, as the explorer returns them) that
// completes the quest. Prices are only looked up for calls that otherwise
// match.
export const findMatchingTx = async (
  specs: VerifierSpec[],
  txs: ExplorerTx[],
  priceOf: PriceOf,
) => {
  for (const tx of txs) {
    for (const spec of specs) {
      if (spec.type !== 'contract-call' || !matchesCall(spec, tx)) continue;
      if (!spec.minUsd || (await meetsMinimum(spec.minUsd, tx, priceOf))) {
        return tx;
      }
    }
  }
  return undefined;
};

// The Ink transaction hash of a Relay request that completes the quest, or
// null. The caller still confirms that transaction onchain.
export const matchingRelayBridge = (
  spec: RelayBridgeSpec,
  request: RelayRequest,
  user: string,
  since: Date,
) => {
  const origin = request.data?.inTxs?.[0]?.chainId;
  const inkTx = request.data?.outTxs?.find((t) => t.chainId === ink.id);
  const usd = Number(request.data?.metadata?.currencyIn?.amountUsd ?? 0);
  const ok =
    request.status === 'success' &&
    request.recipient?.toLowerCase() === user.toLowerCase() &&
    origin !== undefined &&
    spec.fromChains.includes(origin) &&
    Date.parse(request.createdAt) >= since.getTime() &&
    usd >= spec.minUsd;
  return ok && inkTx ? (inkTx.hash as Hex) : null;
};
