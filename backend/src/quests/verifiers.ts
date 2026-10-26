import type { Address, Hex } from 'viem';
import { ink } from 'viem/chains';
import type { ExplorerTx } from './explorer.client';
import type { RelayRequest } from './relay.client';
import { inkySwapValue, type SwapValue } from './swap';
import type { StakingContract } from './nft-stake';
import { velodromeSwapValue } from './velodrome';

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
  // Staking contracts (NFTStake kind, see nft-stake.ts) where an NFT of
  // the collection the wallet has staked, and not yet unstaked, counts as
  // held too: staking moves it out of the wallet.
  stakedIn?: StakingContract[];
};

// A successful Relay bridge to Ink, received by the user's wallet, from one
// of `fromChains`, worth at least `minUsd` (Relay's USD value of what was
// sent), made during the quest's window.
export type RelayBridgeSpec = {
  type: 'relay-bridge';
  fromChains: number[];
  minUsd: number;
};

// A successful swap on InkySwap (its UniversalRouter, V2 or V4 pools, or
// its V2 router) worth at least `minUsd`, valued by its WETH side (oracle
// price) or USD₮0 side ($1), whichever passes. See swap.ts.
export type InkySwapSpec = {
  type: 'inkyswap-swap';
  minUsd: number;
};

// A successful swap through a DEX's router worth at least `minUsd`, valued
// by its WETH side (oracle price) or USD₮0 side ($1), whichever passes. See
// velodrome.ts for how its router's calldata is read.
export type DexSwapSpec = {
  type: 'dex-swap';
  dex: 'velodrome';
  minUsd: number;
};

// At least `minUsd` of futures (perp) volume traded on Nado during the
// quest's window, read from Nado's API (see nado.client.ts). Trades go
// through Nado's orderbook, so there's no transaction of the user's own.
export type NadoPerpVolumeSpec = {
  type: 'nado-perp-volume';
  minUsd: number;
};

const SWAP_VALUE_OF = {
  velodrome: velodromeSwapValue,
};

// Follow an X account. Not checked with X (its API charges per read and
// has no cheap "does A follow B"): the user needs a linked X account, and
// the follow itself is taken on trust.
export type XFollowSpec = {
  type: 'x-follow';
  handle: string;
};

// Having completed at least one daily quest, checked in our own database.
export type DailyQuestDoneSpec = {
  type: 'daily-quest-done';
};

// Opening a page, e.g. a partner's site. Nothing to check: clicking the
// task's link is taken as done.
export type VisitSpec = {
  type: 'visit';
};

// Liking and reposting the X post of the day (social_posts). Taken on
// trust like a follow, and likewise needs a linked X account once X
// linking is set up. Not part of the daily rotation: it shows on the days
// that have a post.
export type XPostSpec = {
  type: 'x-like-repost';
};

export type VerifierSpec =
  | ContractCallSpec
  | NftHolderSpec
  | RelayBridgeSpec
  | InkySwapSpec
  | DexSwapSpec
  | NadoPerpVolumeSpec
  | XFollowSpec
  | DailyQuestDoneSpec
  | VisitSpec
  | XPostSpec;

// USD price of an asset, scaled by 1e8 (the Aave oracle's base unit).
export type PriceOf = (asset: Address) => Promise<bigint>;
export const USD_PRICE_UNIT = 10n ** 8n;

const WETH: Address = '0x4200000000000000000000000000000000000006';
const USDT0: Address = '0x0200C29006150606B650577BBE7B6248F58470c1';
const MIN_QUEST_USD = 1;

// gm.ink (formerly gm.inkonchain.com): ERC1967 proxy, implementation
// GMV2Buyback. Re-check the selectors if the proxy is upgraded.
const GM_CONTRACT: Address = '0x14Aec24CE62258FECDe22E928D8F37dD47165d4F';
// The wallet "send us a GM" quests point at.
const INKQUESTS_GM_RECIPIENT: Address =
  '0x99014f787Fa9b21112194E9C8C0A3E4a22D33670';

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
  // Only a plain GM from the wallet itself counts, not GMs sent to someone
  // else or relayed by an agent.
  'ink-gm': [
    {
      type: 'contract-call',
      contracts: [GM_CONTRACT],
      methods: [
        '0xc0129d43', // gm()
        '0x50915b89', // gmPlus()
      ],
    },
  ],

  // A GM sent to us from the wallet itself (not by an agent), recipient
  // first. gmTo shares the plain GM's 24h cooldown; gmUnlimitedTo (free)
  // and gmPlusTo (paid) don't, so the quest stays doable after a Say GM.
  'ink-gm-to-inkquests': [
    {
      type: 'contract-call',
      contracts: [GM_CONTRACT],
      methods: [
        '0xe884624b', // gmTo(address)
        '0xe9c1b8bb', // gmUnlimitedTo(address)
        '0x96c32612', // gmPlusTo(address)
      ],
      firstArg: INKQUESTS_GM_RECIPIENT,
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

  'inkyswap-swap': [{ type: 'inkyswap-swap', minUsd: MIN_QUEST_USD }],
  'velodrome-swap': [
    { type: 'dex-swap', dex: 'velodrome', minUsd: MIN_QUEST_USD },
  ],

  // Futures on Nado. Its smallest order is $100 of notional, so that's the
  // lowest daily tier; the partner task takes any trade at all.
  'nado-perp-trade': [{ type: 'nado-perp-volume', minUsd: MIN_QUEST_USD }],

  // Campaign tasks (partner quests).
  'x-follow-inkquests': [{ type: 'x-follow', handle: 'inkquests' }],
  'x-follow-stivcrypto': [{ type: 'x-follow', handle: 'stivcrypto' }],
  'x-follow-inkhornet': [{ type: 'x-follow', handle: 'inkthehornet' }],
  'x-follow-boinkverse': [{ type: 'x-follow', handle: 'boinkverse' }],
  'x-follow-squidsonink': [{ type: 'x-follow', handle: 'squidsonink' }],
  'x-follow-nadohq': [{ type: 'x-follow', handle: 'nadoHQ' }],
  'x-follow-tydrohq': [{ type: 'x-follow', handle: 'tydrohq' }],
  'x-follow-0x-snatch': [{ type: 'x-follow', handle: '0x_snatch' }],
  'x-follow-inkbunniesnft': [{ type: 'x-follow', handle: 'InkBunniesNFT' }],
  'any-daily-quest': [{ type: 'daily-quest-done' }],
  'visit-nado-arcade': [{ type: 'visit' }],
  'visit-inkverse': [{ type: 'visit' }],
  'x-like-repost': [{ type: 'x-like-repost' }],

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
  // Many Bunnies are staked in their NFTStake contract, which still counts.
  'hold-ink-bunnies': [
    {
      type: 'nft-holder',
      contract: '0x4443970B315d3c08C2f962fe00770c52396AFDb7',
      stakedIn: [
        {
          kind: 'stake-ids',
          address: '0x058413de8D9c4B76df94CCefC6617ACc5BFE7C57',
        },
      ],
    },
  ],
  'hold-ink-hornet': [
    {
      type: 'nft-holder',
      contract: '0x4d243f15743f6df7c832fcd5ee9a3e8453d47a4b',
    },
  ],
  // Boinks staked in BoinkOGStake (its collection() is this contract)
  // still count.
  'hold-boink': [
    {
      type: 'nft-holder',
      contract: '0x3132e1e8c7a46638b2df26b9252ac5d88d9e04c5',
      stakedIn: [
        {
          kind: 'held-count',
          address: '0x318432e6b670a55Ad19cc052474362FE3D8Ad0d7',
        },
      ],
    },
  ],
  // Behind a minimal proxy; balanceOf goes through it.
  // INKverse (INKVRS), 1,000 one-of-one animated loops.
  'hold-inkverse': [
    {
      type: 'nft-holder',
      contract: '0xfffbd67f37e1e9fd9d9ebef9b687daa72a33da64',
    },
  ],
  'hold-eye-of-the-seeker': [
    {
      type: 'nft-holder',
      contract: '0x9234d821c10b72e09c594f882f1d5dacf2621006',
    },
  ],
  // InkySquad (ISQD), not on OpenSea yet.
  'hold-inky-squad': [
    {
      type: 'nft-holder',
      contract: '0xe4e5d5170ba5cae36d1876893d4b218e8ed19c91',
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

// amount / 10^decimals * price / 1e8 >= usd, in integers (cents).
const worthAtLeast = (
  amount: bigint,
  decimals: number,
  price: bigint,
  usd: number,
) =>
  amount * price * 100n >=
  BigInt(Math.round(usd * 100)) * 10n ** BigInt(decimals) * USD_PRICE_UNIT;

const meetsMinimum = async (min: MinUsd, tx: ExplorerTx, priceOf: PriceOf) => {
  const price = min.pegged ? USD_PRICE_UNIT : await priceOf(min.asset);
  return worthAtLeast(txAmount(min, tx), min.decimals, price, min.usd);
};

// A swap is worth `usd` if either side is: its USD₮0 at exactly $1 (like
// the Tydro USDT quest), or its WETH at the oracle price.
const swapWorthAtLeast = async (
  value: SwapValue | null,
  usd: number,
  priceOf: PriceOf,
) => {
  if (!value) return false;
  if (worthAtLeast(value.usdt0, 6, USD_PRICE_UNIT, usd)) return true;
  if (value.weth === 0n) return false;
  return worthAtLeast(value.weth, 18, await priceOf(WETH), usd);
};

const txMatches = async (
  spec: VerifierSpec,
  tx: ExplorerTx,
  priceOf: PriceOf,
) => {
  if (spec.type === 'contract-call') {
    if (!matchesCall(spec, tx)) return false;
    return !spec.minUsd || meetsMinimum(spec.minUsd, tx, priceOf);
  }
  if (spec.type === 'inkyswap-swap') {
    return swapWorthAtLeast(inkySwapValue(tx), spec.minUsd, priceOf);
  }
  if (spec.type === 'dex-swap') {
    return swapWorthAtLeast(SWAP_VALUE_OF[spec.dex](tx), spec.minUsd, priceOf);
  }
  // Holding and bridge specs aren't about the user's own transactions.
  return false;
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
      if (await txMatches(spec, tx, priceOf)) return tx;
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

// The verifier with every amount check set to `usd` (a quest's own
// minimum, e.g. its $5 variant); null keeps the verifier's defaults.
export const withMinUsd = (
  specs: VerifierSpec[],
  usd: number | null,
): VerifierSpec[] =>
  usd === null
    ? specs
    : specs.map((spec) => {
        if (spec.type === 'contract-call' && spec.minUsd) {
          return { ...spec, minUsd: { ...spec.minUsd, usd } };
        }
        if (
          spec.type === 'relay-bridge' ||
          spec.type === 'inkyswap-swap' ||
          spec.type === 'dex-swap' ||
          spec.type === 'nado-perp-volume'
        ) {
          return { ...spec, minUsd: usd };
        }
        return spec;
      });

// The minimum a verifier asks for, for messages; null if it has no amount
// check (e.g. a GM).
export const minUsdOf = (specs: VerifierSpec[]): number | null => {
  for (const spec of specs) {
    if (spec.type === 'contract-call' && spec.minUsd) return spec.minUsd.usd;
    if (
      spec.type === 'relay-bridge' ||
      spec.type === 'inkyswap-swap' ||
      spec.type === 'dex-swap' ||
      spec.type === 'nado-perp-volume'
    ) {
      return spec.minUsd;
    }
  }
  return null;
};

// What kind of task a quest is, for the frontend's buttons: follow on X,
// hold an NFT, do a daily quest, open a page, or some onchain action.
export type TaskType =
  | 'x-follow'
  | 'nft-holder'
  | 'daily-quest'
  | 'visit'
  | 'x-post'
  | 'onchain';

export const taskTypeOf = (verifier: string | null): TaskType => {
  const type = verifier ? VERIFIERS[verifier]?.[0]?.type : undefined;
  if (type === 'x-follow') return 'x-follow';
  if (type === 'nft-holder') return 'nft-holder';
  if (type === 'daily-quest-done') return 'daily-quest';
  if (type === 'visit') return 'visit';
  if (type === 'x-like-repost') return 'x-post';
  return 'onchain';
};

// Checks that aren't an onchain action by the user; they don't count for
// referral rewards.
export const isOffchain = (specs: VerifierSpec[]) =>
  specs.every(
    (s) =>
      s.type === 'x-follow' ||
      s.type === 'daily-quest-done' ||
      s.type === 'visit' ||
      s.type === 'x-like-repost',
  );

// The daily "like & repost the post of the day" quest, which lives outside
// the rotation.
export const isPostOfTheDay = (verifier: string | null) =>
  taskTypeOf(verifier) === 'x-post';
