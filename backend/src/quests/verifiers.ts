import { formatUnits, type Address, type Hex } from 'viem';
import { ink } from 'viem/chains';
import type { ExplorerTokenTransfer, ExplorerTx } from './explorer.client';
import type { CowOrder } from './cow.client';
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

// Buying at least `minUsd` of an ERC-20 during the quest's window: the
// user's wallet received `token` from a contract (a pool, router or
// aggregator), valued at its explorer (CoinGecko) price or by the ETH the
// user paid for it (see findTokenBuy). Any DEX or
// aggregator counts, and so do smart wallets: what's checked is the token
// arriving, not the transaction that bought it. A plain send from another
// wallet doesn't count; adding liquidity's refund does, which is fine at
// these amounts.
export type TokenBuySpec = {
  type: 'token-buy';
  token: Address;
  minUsd: number;
};

// A CoW Swap order settled during the quest's window worth at least
// `minUsd`, read from CoW's API (see cow.client.ts), valued like the other
// swaps by its WETH (or ETH) side or its USD₮0 side.
// With `buys` the order must buy that token, e.g. a tokenized stock, and
// USDC and USDG (what the stock pools trade against) count at $1 too.
export type CowSwapSpec = {
  type: 'cow-swap';
  minUsd: number;
  buys?: Address;
};

// Holding an ERC-20 at claim time, read with balanceOf over RPC: at least
// `minBalance` whole tokens, or tokens worth at least `minUsd` at the
// explorer's (CoinGecko) price. No transaction is involved.
export type TokenHolderSpec = {
  type: 'token-holder';
  token: Address;
  decimals: number;
} & ({ minBalance: number } | { minUsd: number });

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
  | TokenBuySpec
  | TokenHolderSpec
  | CowSwapSpec
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
// Tokenized stock buys (see the cow-buy-* verifiers).
const MIN_STOCK_USD = 5;

// gm.ink (formerly gm.inkonchain.com): ERC1967 proxy, implementation
// GMV2Buyback. Re-check the selectors if the proxy is upgraded.
const GM_CONTRACT: Address = '0x14Aec24CE62258FECDe22E928D8F37dD47165d4F';
// Our wallet: where "send us a GM" quests point, and our referrer in
// partner apps.
const INKQUESTS_WALLET: Address = '0x99014f787Fa9b21112194E9C8C0A3E4a22D33670';

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
      firstArg: INKQUESTS_WALLET,
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
  'cow-swap': [{ type: 'cow-swap', minUsd: MIN_QUEST_USD }],
  // Tokenized stocks: Backed's wrapped xStocks (deployed by its
  // WrappedBackedTokenFactory 0x28b4…Db2A), the ones with real pools on Ink
  // (Uniswap, against USDG). The plain xStocks (NVDAX, …) have none: CoW
  // takes them from $10 only and selling small amounts back loses most of
  // it. The wrapped ones trade on CoW from $5 at about 0.2% round trip.
  'cow-buy-wspyx': [
    {
      type: 'cow-swap',
      minUsd: MIN_STOCK_USD,
      buys: '0xE7E553Cd128F0011777323A0b44a7b96EA1CB540',
    },
  ],
  'cow-buy-wqqqx': [
    {
      type: 'cow-swap',
      minUsd: MIN_STOCK_USD,
      buys: '0x4C1AE29c159838fC1b224636E28E086EB69101f7',
    },
  ],
  'cow-buy-wmstrx': [
    {
      type: 'cow-swap',
      minUsd: MIN_STOCK_USD,
      buys: '0x30987adF0B11dc698438a99BA04ec3a1AB2c7EaB',
    },
  ],
  'cow-buy-waaplx': [
    {
      type: 'cow-swap',
      minUsd: MIN_STOCK_USD,
      buys: '0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f',
    },
  ],

  // Futures on Nado. Its smallest order is $100 of notional, so that's the
  // lowest daily tier; the partner task takes any trade at all.
  'nado-perp-trade': [{ type: 'nado-perp-volume', minUsd: MIN_QUEST_USD }],

  // Ink community tokens (ERC-20, 18 decimals, priced on the explorer).
  'buy-krakmask': [
    {
      type: 'token-buy',
      token: '0x32bCB803f696C99Eb263D60a05CAfD8689026575', // Krak Mask
      minUsd: MIN_QUEST_USD,
    },
  ],
  'buy-anita': [
    {
      type: 'token-buy',
      token: '0x0606FC632ee812bA970af72F8489baAa443C4B98', // ANITA
      minUsd: MIN_QUEST_USD,
    },
  ],
  'buy-beast': [
    {
      type: 'token-buy',
      token: '0xD95B9A5Fa7C2708fD4FE0E07E59bDE1Ef35b194a', // Kraken Mascot
      minUsd: MIN_QUEST_USD,
    },
  ],

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
  'x-follow-krakmask': [{ type: 'x-follow', handle: 'KrakMask' }],
  'visit-krak-heads': [{ type: 'visit' }],
  'hold-krakmask-10k': [
    {
      type: 'token-holder',
      token: '0x32bCB803f696C99Eb263D60a05CAfD8689026575', // Krak Mask
      decimals: 18,
      minBalance: 10_000,
    },
  ],
  'x-follow-xstocksfi': [{ type: 'x-follow', handle: 'xStocksFi' }],
  'visit-xstocks-points': [{ type: 'visit' }],
  // wSPYx, the wrapped S&P 500 xStock (see the cow-buy-* verifiers).
  'hold-wspyx-10usd': [
    {
      type: 'token-holder',
      token: '0xE7E553Cd128F0011777323A0b44a7b96EA1CB540',
      decimals: 18,
      minUsd: 10,
    },
  ],
  // BOI (work.boi.market), an NFT economy of BOIs, LadyBOIs and SmolBois,
  // one campaign per feature. Its contracts are unverified; selectors are
  // read from the app's ABI.
  'x-follow-boi-market': [{ type: 'x-follow', handle: 'boi_market' }],
  // Registering our wallet as the referrer on SmolBoi's ReferralRegistry
  // (its app's Referrals page, opened from our ?ref= link).
  'register-boi-referral': [
    {
      type: 'contract-call',
      contracts: ['0xA4B4f96f169d47Acb9f595b015335F566E218AF1'],
      methods: ['0x9ea7685a'], // registerReferrer(address)
      firstArg: INKQUESTS_WALLET,
    },
  ],
  // Part 1: S.E.X. A BOI and a LadyBOI are paired to birth a SmolBoi; the
  // pair stays in the wallet (locked, not transferred), so holding them
  // still passes after.
  'hold-boi': [
    {
      type: 'nft-holder',
      contract: '0x63FEbFa0a5474803F4261a1628763b1B2cC3AB83',
    },
  ],
  'hold-ladyboi': [
    {
      type: 'nft-holder',
      contract: '0xD4fF4Ab9286AfF65C89c9df61323E5994B5F78d1',
    },
  ],
  // Starting a S.E.X. event on its SexEngine (paid in ETH). The SmolBoi is
  // claimed later; starting is the user's move, so that's what counts.
  'sex-boi': [
    {
      type: 'contract-call',
      contracts: ['0x7f39e20CFbB415eF3425b56e90aA043be4641C28'],
      methods: [
        '0xebdc52ea', // startSex(uint256,uint256)
        '0x5c9a1acc', // startSexBatch(uint256[],uint256[])
      ],
    },
  ],
  // Part 2: Merge, not live yet.
  // 'visit-boi': [{ type: 'visit' }],
  // 'hold-smolboi': [
  //   {
  //     type: 'nft-holder',
  //     contract: '0x17c700F1e302069eE01249aa4C2313371f993b57',
  //   },
  // ],
  // // Starting a merge of two SmolBois on its MergeEngine. A merge is
  // // started, then finalized once its randomness lands; starting is the
  // // user's move (and pays the fee), so that's what counts.
  // 'merge-smolboi': [
  //   {
  //     type: 'contract-call',
  //     contracts: ['0x9E9999D8150a2ccf7C834D5BD7a1C40ed1EA8525'],
  //     methods: [
  //       '0x1374cadb', // startMerge(uint256,uint256,bool)
  //       '0xa1a87a3d', // startMergeBatch(uint256[],uint256[])
  //     ],
  //   },
  // ],
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

// CoW sells and buys native ETH under this placeholder address.
const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// More dollars a stock buy can be paid in, 6 decimals like USD₮0.
const STOCK_STABLES = [
  '0x2d270e6886d130d724215a266106e6832161eaed', // USDC
  '0xe343167631d89b6ffc58b88d6b7fb0228795491d', // USDG (Global Dollar)
];

// What a settled CoW order swapped in WETH (ETH counts as WETH) and USD₮0
// (and USDC and USDG when `withStables`, at $1); null when it isn't
// settled.
const cowOrderValue = (
  order: CowOrder,
  withStables: boolean,
): SwapValue | null => {
  if (order.status !== 'fulfilled') return null;
  const value: SwapValue = { weth: 0n, usdt0: 0n };
  const sides = [
    [order.sellToken, order.executedSellAmount],
    [order.buyToken, order.executedBuyAmount],
  ] as const;
  for (const [token, amount] of sides) {
    const t = token.toLowerCase();
    if (t === WETH.toLowerCase() || t === NATIVE_ETH)
      value.weth = BigInt(amount);
    if (
      t === USDT0.toLowerCase() ||
      (withStables && STOCK_STABLES.includes(t))
    ) {
      value.usdt0 = BigInt(amount);
    }
  }
  return value;
};

// The first of the user's CoW orders (newest first, as the API returns
// them) placed since `since` that completes the quest, or undefined.
export const findCowSwap = async (
  spec: CowSwapSpec,
  orders: CowOrder[],
  since: Date,
  priceOf: PriceOf,
) => {
  const buys = spec.buys?.toLowerCase();
  for (const order of orders) {
    if (Date.parse(order.creationDate) < since.getTime()) continue;
    if (buys && order.buyToken.toLowerCase() !== buys) continue;
    const value = cowOrderValue(order, Boolean(buys));
    if (await swapWorthAtLeast(value, spec.minUsd, priceOf)) return order;
  }
  return undefined;
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

// The share of a USD minimum that passes when it's valued at a token's
// price (a token buy, a token holding): $0.95 of $1, $9.50 of $10. Fees,
// slippage and a lagging price leave an exact buy a few cents short.
export const PRICE_TOLERANCE = 0.95;

// The first transfer (newest first, as the explorer returns them) from a
// contract that buys at least `spec.minUsd`: worth that at `usdPrice`, or
// paid for with that much ETH (`paidUsd` of its transaction). The ETH side
// matters: fees, slippage and a lagging token price leave a $1 buy short
// of $1 of tokens. Even the ETH can come out a few cents short when the
// DEX prices ETH above our oracle, so 95% of the minimum is enough. Its
// transaction hash, or null. `transfers` are the ones the user received
// during the quest's window.
export const findTokenBuy = async (
  spec: TokenBuySpec,
  transfers: ExplorerTokenTransfer[],
  usdPrice: number,
  isContract: (address: Address) => Promise<boolean>,
  paidUsd: (hash: Hex) => Promise<number>,
) => {
  const token = spec.token.toLowerCase();
  const enough = spec.minUsd * PRICE_TOLERANCE;
  for (const t of transfers) {
    if (t.contractAddress.toLowerCase() !== token) continue;
    if (!(await isContract(t.from as Address))) continue;
    const amount = Number(formatUnits(BigInt(t.value), Number(t.tokenDecimal)));
    if (amount * usdPrice >= enough) return t.hash;
    if ((await paidUsd(t.hash)) >= enough) return t.hash;
  }
  return null;
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
          spec.type === 'nado-perp-volume' ||
          spec.type === 'token-buy' ||
          spec.type === 'cow-swap'
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
      spec.type === 'nado-perp-volume' ||
      spec.type === 'token-buy' ||
      spec.type === 'cow-swap'
    ) {
      return spec.minUsd;
    }
  }
  return null;
};

// What kind of task a quest is, for the frontend's buttons: follow on X,
// hold an NFT or tokens, do a daily quest, open a page, or some onchain
// action.
export type TaskType =
  | 'x-follow'
  | 'nft-holder'
  | 'token-holder'
  | 'daily-quest'
  | 'visit'
  | 'x-post'
  | 'onchain';

export const taskTypeOf = (verifier: string | null): TaskType => {
  const type = verifier ? VERIFIERS[verifier]?.[0]?.type : undefined;
  if (type === 'x-follow') return 'x-follow';
  if (type === 'nft-holder') return 'nft-holder';
  if (type === 'token-holder') return 'token-holder';
  if (type === 'daily-quest-done') return 'daily-quest';
  if (type === 'visit') return 'visit';
  if (type === 'x-like-repost') return 'x-post';
  return 'onchain';
};

// The ERC-20 a quest is about (bought, held, or bought on CoW), so the app
// can offer its contract address to copy; null for every other quest.
export const tokenOf = (verifier: string | null): Address | null => {
  const spec = verifier ? VERIFIERS[verifier]?.[0] : undefined;
  if (spec?.type === 'token-buy' || spec?.type === 'token-holder') {
    return spec.token;
  }
  if (spec?.type === 'cow-swap') return spec.buys ?? null;
  return null;
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
