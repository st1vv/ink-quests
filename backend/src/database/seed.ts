// The quest catalog lives here, in code: edit the lists below and run
// `npm run db:seed`. Rows are matched by slug and every field is overwritten,
// so this file is the source of truth. A partner or quest removed from the
// file is deactivated, not deleted, because completions still point at it.
import { getTableColumns, notInArray, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { createDatabase } from './client';
import { challenges, partners, quests } from './schema';
import { loadEnvFile } from '../config/load-env-file';
import { VERIFIERS } from '../quests/verifiers';

loadEnvFile();

// Badges on a partner's card. Add new ones here so every partner spells
// them the same way.
type PartnerTag = 'NFT' | 'Token' | 'Perp DEX' | 'Lending' | 'xStocks';

type SeedPartner = Omit<
  typeof partners.$inferInsert,
  'id' | 'createdAt' | 'tags'
> & { tags?: PartnerTag[] };

// Badges on a daily quest: what the user does. Add new ones here so every
// quest spells them the same way.
type QuestTag =
  | 'GM'
  | 'DEX'
  | 'Lending'
  | 'Bridge'
  | 'NFT'
  | 'Perp DEX'
  | 'Social'
  | 'Token'
  | 'xStocks';

type SeedQuest = Omit<
  typeof quests.$inferInsert,
  'id' | 'createdAt' | 'partnerId' | 'tags'
> & {
  // Slug of the partner, required for kind 'partner'.
  partner?: string;
  tags?: QuestTag[];
};

// Every Nado link carries our referral code.
const NADO_URL = 'https://app.nado.xyz?join=inkquests';

// Tydro's ETH (WETH) market, where ETH supply quests point.
const TYDRO_WETH_URL =
  'https://app.tydro.com/reserve-overview/?underlyingAsset=0x4200000000000000000000000000000000000006&marketName=proto_ink_v3';

// BOI's W.O.R.K. app, routed by the hash (#guide, #merge, …).
const BOI_WORK_URL = 'https://work.boi.market/';
// Its Referrals page with our wallet as the referrer, filled in for the
// user to register. Only the optional referral task uses it.
const BOI_REFERRAL_URL =
  'https://work.boi.market/?ref=0x99014f787Fa9b21112194E9C8C0A3E4a22D33670#referrals';

const PARTNERS: SeedPartner[] = [
  {
    slug: 'inkquests',
    title: 'InkQuests',
    description:
      'Get started with InkQuests: follow us on X and complete your first daily quest.',
    imageUrl: '/campaigns/inkquests.webp',
    websiteUrl: 'https://inkquests.xyz',
    rewardXp: 100,
  },
  {
    slug: 'inkhornet',
    title: 'Ink Hornet',
    description: '2,222 Hornets on Ink Chain. Angry. Unfriendly. Unexplained.',
    imageUrl: '/campaigns/ink-hornet.webp',
    websiteUrl: 'https://www.inkhornet.com/',
    rewardXp: 100,
    tags: ['NFT'],
  },
  {
    slug: 'boink',
    title: 'Boink',
    description: 'Collection of 777 Boinks.',
    imageUrl: '/campaigns/boink.webp',
    websiteUrl: 'https://www.boinkverse.ink/',
    rewardXp: 100,
    tags: ['NFT'],
  },
  {
    slug: 'inky-squad',
    title: 'Inky Squad',
    description:
      "A bunch of drippy sea punks having fun. We're here to ink the game, not play it.",
    imageUrl: '/campaigns/inky-squad.webp',
    rewardXp: 100,
    tags: ['NFT'],
  },
  {
    slug: 'nado',
    title: 'Nado',
    description:
      'All in one CLOB DEX on Ink: spot, perps and money markets with unified margin.',
    imageUrl: '/campaigns/nado.webp',
    websiteUrl: NADO_URL,
    rewardXp: 100,
    tags: ['Perp DEX'],
  },
  {
    slug: 'tydro',
    title: 'Tydro',
    description:
      'Lending market on Ink: supply crypto to earn, or borrow against it.',
    imageUrl: '/campaigns/tydro.webp',
    websiteUrl: 'https://app.tydro.com',
    rewardXp: 100,
    tags: ['Lending'],
  },
  {
    slug: 'inkverse',
    title: 'INKverse',
    description:
      'INKverse is a community art collection for Ink: 1,000 animated loops, each a one-of-one artwork created in code from the INK mark — puns, geometry, retro screens, design movements and living systems.',
    imageUrl: '/campaigns/inkverse.webp',
    websiteUrl: 'https://inkside.fun/inkverse',
    rewardXp: 100,
    tags: ['NFT'],
  },
  {
    slug: 'ink-bunnies',
    title: 'Ink Bunnies',
    description: '2222 Unique Bunnies NFTs on Ink Chain',
    imageUrl: '/campaigns/ink-bunnies.webp',
    websiteUrl: 'https://inkbunnies.xyz/',
    rewardXp: 100,
    tags: ['NFT'],
  },
  {
    slug: 'krak-mask',
    title: 'Krak Mask',
    description:
      'The mask stays on. A community meme token on Ink, and the home of 888 Krak Heads pulled straight from its daily memes.',
    imageUrl: '/campaigns/krak-mask.webp',
    websiteUrl: 'https://www.krakmask.ink/',
    rewardXp: 100,
    tags: ['Token', 'NFT'],
  },
  {
    slug: 'xstocks',
    title: 'xStocks',
    description:
      'Tokenized US stocks and ETFs, backed 1:1 and tradable 24/7 onchain. Hold xStocks or put them to work in DeFi to earn xPoints.',
    imageUrl: '/campaigns/xstocks.webp',
    // Our referral link to the xPoints program.
    websiteUrl: 'https://defi.xstocks.fi/points?ref=INKQUESTS',
    rewardXp: 100,
    tags: ['xStocks'],
  },
  // BOI, one campaign per feature of its protocol: S.E.X. first, Merge and
  // the rest to follow.
  {
    slug: 'boi-part-1',
    title: 'BOI Part 1: S.E.X.',
    description:
      'An NFT economy on Ink. Start with S.E.X.: pair a BOI with a LadyBOI to birth a SmolBoi.',
    imageUrl: '/campaigns/boi-part-1.webp',
    websiteUrl: BOI_WORK_URL,
    rewardXp: 100,
    tags: ['NFT'],
  },
  {
    slug: 'boi-part-2',
    title: 'BOI Part 2: Merge',
    description:
      'Level up your SmolBois: merge two of the same level into one stronger Smol.',
    // Until this file is added the card shows its gradient fallback.
    imageUrl: '/campaigns/boi-part-2.webp',
    websiteUrl: BOI_WORK_URL,
    rewardXp: 100,
    tags: ['NFT'],
  },
];

// Amount quests come in $1 / $5 / $10 variants (or the quest's own
// `tiers`), each 10 XP more than the last. They share a group, so the daily
// rotation picks only one of them a day. The first variant keeps the
// original slug and its completion history.
const AMOUNT_TIERS = [1, 5, 10];
const TIER_BONUS_XP = 10;

const tiered = (quest: {
  slug: string;
  title: (usd: number) => string;
  description: (usd: number) => string;
  actionUrl: string;
  points: number;
  sortOrder: number;
  verifier: string;
  tags: QuestTag[];
  tiers?: number[];
}): SeedQuest[] =>
  (quest.tiers ?? AMOUNT_TIERS).map((usd, i) => ({
    slug: i === 0 ? quest.slug : `${quest.slug}-${usd}usd`,
    kind: 'daily',
    title: quest.title(usd),
    description: quest.description(usd),
    actionUrl: quest.actionUrl,
    points: quest.points + i * TIER_BONUS_XP,
    sortOrder: quest.sortOrder,
    verifier: quest.verifier,
    minUsd: usd,
    groupKey: quest.slug,
    tags: quest.tags,
  }));

// The daily pool: each day shows 3 of these (see catalog/rotation.ts), from
// 3 different groups.
const QUESTS: SeedQuest[] = [
  // Not in the rotation: shown every day that has a post of the day (set on
  // the statistics page), which also becomes its link.
  {
    slug: 'daily-x-like-repost',
    kind: 'daily',
    title: 'Like & repost on X',
    description: "Like and repost today's InkQuests post on X.",
    actionUrl: 'https://x.com/inkquests',
    points: 20,
    sortOrder: 0,
    verifier: 'x-like-repost',
    tags: ['Social'],
  },
  {
    slug: 'daily-gm',
    kind: 'daily',
    title: 'Say GM',
    description: 'Say GM on the official platform.',
    actionUrl: 'https://gm.inkonchain.com/',
    points: 20,
    sortOrder: 1,
    verifier: 'ink-gm',
    tags: ['GM'],
    // Shares a group with the GM to InkQuests: a plain GM and a gmTo share
    // one 24h cooldown on the GM contract, so they never show together.
    groupKey: 'daily-gm',
  },
  {
    slug: 'daily-gm-to-inkquests',
    kind: 'daily',
    title: 'Send a GM to InkQuests',
    description:
      'Send a GM to the InkQuests wallet 0x99014f787Fa9b21112194E9C8C0A3E4a22D33670 on the official platform.',
    actionUrl:
      'https://www.gm.ink?to=0x99014f787Fa9b21112194E9C8C0A3E4a22D33670',
    points: 20,
    sortOrder: 1,
    verifier: 'ink-gm-to-inkquests',
    tags: ['GM'],
    groupKey: 'daily-gm',
  },
  ...tiered({
    slug: 'daily-inkyswap-swap',
    title: (usd) => `Swap $${usd} on InkySwap`,
    description: (usd) =>
      `Swap at least $${usd} worth on InkySwap to complete this daily quest.`,
    actionUrl: 'https://inkyswap.com/swap',
    points: 30,
    sortOrder: 2,
    verifier: 'inkyswap-swap',
    tags: ['DEX'],
  }),
  ...tiered({
    slug: 'daily-velodrome-swap',
    title: (usd) => `Swap $${usd} on Velodrome`,
    description: (usd) =>
      `Swap at least $${usd} worth on Velodrome to complete this daily quest. Swaps to or from ETH or USD₮0 count.`,
    actionUrl: 'https://velo.drome.eth.limo/swap?chain0=57073&chain1=57073',
    points: 30,
    sortOrder: 3,
    verifier: 'velodrome-swap',
    tags: ['DEX'],
  }),
  ...tiered({
    slug: 'daily-cow-swap',
    title: (usd) => `Swap $${usd} on CoW Swap`,
    description: (usd) =>
      `Swap at least $${usd} worth on CoW Swap to complete this daily quest. Swaps to or from ETH or USD₮0 count.`,
    // Our referral code, on CoW Swap's Ink ETH → USD₮0 page.
    actionUrl: 'https://swap.cow.fi/?ref=INKQUESTS#/57073/swap/ETH/USDT0',
    points: 30,
    sortOrder: 6,
    verifier: 'cow-swap',
    tags: ['DEX'],
  }),
  // Buy a tokenized stock: one group, so at most one of them a day. These
  // are Backed's wrapped xStocks, the ones with real pools on Ink (see the
  // cow-buy-* verifiers), so $5 trades fine both ways.
  ...[
    {
      symbol: 'wSPYx',
      name: 'S&P 500',
      token: '0xE7E553Cd128F0011777323A0b44a7b96EA1CB540',
    },
    {
      symbol: 'wQQQx',
      name: 'Nasdaq',
      token: '0x4C1AE29c159838fC1b224636E28E086EB69101f7',
    },
    {
      symbol: 'wMSTRx',
      name: 'MicroStrategy',
      token: '0x30987adF0B11dc698438a99BA04ec3a1AB2c7EaB',
    },
    {
      symbol: 'wAAPLx',
      name: 'Apple',
      token: '0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f',
    },
  ].map(
    ({ symbol, name, token }): SeedQuest => ({
      slug: `daily-buy-${symbol.toLowerCase()}`,
      kind: 'daily',
      title: `Buy $5 of ${symbol}`,
      description: `Buy at least $5 of ${symbol}, the ${name} tokenized stock, on CoW Swap to complete this daily quest. Pay with USDG for the best price: the stock pools on Ink trade against it.`,
      // Our referral code, on CoW Swap's Ink USDG → stock page.
      actionUrl: `https://swap.cow.fi/?ref=INKQUESTS#/57073/swap/USDG/${token}`,
      points: 40,
      sortOrder: 6,
      verifier: `cow-buy-${symbol.toLowerCase()}`,
      minUsd: 5,
      groupKey: 'daily-buy-stock',
      tags: ['DEX', 'xStocks'],
    }),
  ),
  ...tiered({
    slug: 'daily-tydro-supply-weth',
    title: (usd) => `Supply $${usd} of ETH on Tydro`,
    description: (usd) =>
      `Supply at least $${usd} of ETH (or WETH) to the Tydro lending market to complete this daily quest.`,
    actionUrl: TYDRO_WETH_URL,
    points: 30,
    sortOrder: 4,
    verifier: 'tydro-supply-weth',
    tags: ['Lending'],
  }),
  ...tiered({
    slug: 'daily-tydro-supply-usdt',
    title: (usd) => `Supply ${usd} USD₮0 on Tydro`,
    description: (usd) =>
      `Supply at least ${usd} USD₮0 to the Tydro lending market to complete this daily quest.`,
    actionUrl:
      'https://app.tydro.com/reserve-overview/?underlyingAsset=0x0200c29006150606b650577bbe7b6248f58470c1&marketName=proto_ink_v3',
    points: 30,
    sortOrder: 5,
    verifier: 'tydro-supply-usdt',
    tags: ['Lending'],
  }),
  ...tiered({
    slug: 'daily-relay-bridge',
    title: (usd) => `Bridge $${usd} to Ink with Relay`,
    description: (usd) =>
      `Bridge at least $${usd} to Ink from Ethereum, Base, Arbitrum or Robinhood Chain with Relay.`,
    actionUrl: 'https://relay.link/bridge/ink',
    points: 50,
    sortOrder: 9,
    verifier: 'relay-bridge-to-ink',
    tags: ['Bridge'],
  }),
  ...tiered({
    slug: 'daily-nado-futures',
    title: (usd) => `Trade $${usd} of futures on Nado`,
    description: (usd) =>
      `Trade at least $${usd} of futures (perps) on Nado today. Volume counts with leverage. Nado's stats can take up to 20 minutes to update.`,
    actionUrl: NADO_URL,
    points: 50,
    sortOrder: 12,
    verifier: 'nado-perp-trade',
    tags: ['Perp DEX'],
    tiers: [100, 150, 200],
  }),
  // Buy a community token: one group, so at most one of them a day.
  ...[
    { symbol: 'KRAKMASK', token: '0x32bCB803f696C99Eb263D60a05CAfD8689026575' },
    { symbol: 'ANITA', token: '0x0606FC632ee812bA970af72F8489baAa443C4B98' },
    { symbol: 'BEAST', token: '0xD95B9A5Fa7C2708fD4FE0E07E59bDE1Ef35b194a' },
  ].map(
    ({ symbol, token }): SeedQuest => ({
      slug: `daily-buy-${symbol.toLowerCase()}`,
      kind: 'daily',
      title: `Buy $1 of ${symbol}`,
      description: `Buy at least $1 worth of ${symbol} on Ink, on InkyPump or any DEX, to complete this daily quest.`,
      // The token's trading page; any other DEX or aggregator counts too.
      actionUrl: `https://inkypump.com/ink/trade/${token}`,
      points: 30,
      sortOrder: 15,
      verifier: `buy-${symbol.toLowerCase()}`,
      minUsd: 1,
      groupKey: 'daily-buy-token',
      tags: ['Token'],
    }),
  ),
  // Paused for now: uncomment to put it back in the rotation.
  // {
  //   slug: 'daily-hold-templars-of-the-storm',
  //   kind: 'daily',
  //   title: 'Hold a Templars of the Storm NFT',
  //   description:
  //     'Hold at least one Templars of the Storm NFT in your wallet to claim this daily reward.',
  //   actionUrl: 'https://opensea.io/collection/templars-of-the-storm',
  //   points: 100,
  //   sortOrder: 6,
  //   verifier: 'hold-templars-of-the-storm',
  //   tags: ['NFT'],
  // },
  {
    slug: 'daily-hold-rekt-ink',
    kind: 'daily',
    title: 'Hold a Rekt Ink NFT',
    description:
      'Hold at least one Rekt Ink NFT in your wallet to claim this daily reward.',
    actionUrl: 'https://opensea.io/collection/rekt-ink',
    points: 50,
    sortOrder: 7,
    verifier: 'hold-rekt-ink',
    tags: ['NFT'],
  },
  {
    slug: 'daily-hold-ink-bunnies',
    kind: 'daily',
    title: 'Hold an INK Bunnies NFT',
    description:
      'Hold at least one INK Bunnies NFT in your wallet or staked on stake.inkbunnies.xyz to claim this daily reward.',
    actionUrl: 'https://opensea.io/collection/inkbunnies',
    points: 50,
    sortOrder: 8,
    verifier: 'hold-ink-bunnies',
    tags: ['NFT'],
  },
  {
    slug: 'daily-hold-ink-hornet',
    kind: 'daily',
    title: 'Hold an Ink Hornet NFT',
    description:
      'Hold at least one Ink Hornet NFT in your wallet to claim this daily reward.',
    actionUrl: 'https://opensea.io/collection/ink-hornet',
    points: 50,
    sortOrder: 10,
    verifier: 'hold-ink-hornet',
    tags: ['NFT'],
  },
  {
    slug: 'daily-hold-boink',
    kind: 'daily',
    title: 'Hold a Boink NFT',
    description:
      'Hold at least one Boink NFT in your wallet or staked on boinkverse.ink/boink-staking to claim this daily reward.',
    actionUrl: 'https://opensea.io/collection/boinknfts',
    points: 50,
    sortOrder: 11,
    verifier: 'hold-boink',
    tags: ['NFT'],
  },
  {
    slug: 'daily-hold-eye-of-the-seeker',
    kind: 'daily',
    title: 'Hold an Eye of the Seeker NFT',
    description:
      'Hold at least one Eye of the Seeker NFT in your wallet to claim this daily reward.',
    actionUrl: 'https://opensea.io/collection/eye-of-the-seeker',
    points: 30,
    sortOrder: 13,
    verifier: 'hold-eye-of-the-seeker',
    tags: ['NFT'],
  },
  {
    slug: 'daily-hold-inkverse',
    kind: 'daily',
    title: 'Hold an INKverse NFT',
    description:
      'Hold at least one INKverse NFT in your wallet to claim this daily reward.',
    actionUrl: 'https://opensea.io/collection/inkverse-920024436',
    points: 50,
    sortOrder: 14,
    verifier: 'hold-inkverse',
    tags: ['NFT'],
  },
  // Campaigns (partner quests): one-time tasks grouped under a partner,
  // shown on the Quests page. Tasks are worth 0 XP; the partner's rewardXp
  // is paid once all of them are verified. Follows on X need a linked X
  // account and are taken on trust; the rest are checked.
  {
    // The slug keeps the old handle on purpose: renaming it would make a new
    // task and send everyone who already verified it back to redo it.
    slug: 'inkquests-follow-stanislav1w',
    kind: 'partner',
    partner: 'inkquests',
    title: 'Follow @stivcrypto on X',
    description: 'Follow the builder behind InkQuests on X.',
    actionUrl: 'https://x.com/intent/follow?screen_name=stivcrypto',
    points: 0,
    sortOrder: 1,
    verifier: 'x-follow-stivcrypto',
  },
  {
    slug: 'inkquests-follow-inkquests',
    kind: 'partner',
    partner: 'inkquests',
    title: 'Follow @inkquests on X',
    description: 'Follow InkQuests on X for news, new quests and rewards.',
    actionUrl: 'https://x.com/intent/follow?screen_name=inkquests',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-inkquests',
  },
  {
    slug: 'inkquests-complete-daily-quest',
    kind: 'partner',
    partner: 'inkquests',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 3,
    verifier: 'any-daily-quest',
  },
  // Ink Hornet
  {
    slug: 'inkhornet-hold-inkhornet',
    kind: 'partner',
    partner: 'inkhornet',
    title: 'Hold an Ink Hornet NFT',
    description: 'Hold at least one Ink Hornet NFT in your wallet.',
    actionUrl: 'https://opensea.io/collection/ink-hornet',
    points: 0,
    sortOrder: 1,
    verifier: 'hold-ink-hornet',
  },
  {
    slug: 'inkhornet-follow-inkhornet',
    kind: 'partner',
    partner: 'inkhornet',
    title: 'Follow @inkthehornet on X',
    description:
      'Follow Ink Hornet on X to keep up with announcements and community news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=inkthehornet',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-inkhornet',
  },
  {
    slug: 'inkhornet-complete-daily-quest',
    kind: 'partner',
    partner: 'inkhornet',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 3,
    verifier: 'any-daily-quest',
  },
  // Boink
  {
    slug: 'boink-hold-boink',
    kind: 'partner',
    partner: 'boink',
    title: 'Hold a Boink NFT',
    description:
      'Hold at least one Boink NFT in your wallet or staked on boinkverse.ink/boink-staking.',
    actionUrl: 'https://opensea.io/collection/boinknfts',
    points: 0,
    sortOrder: 1,
    verifier: 'hold-boink',
  },
  {
    slug: 'boink-follow-boinkverse',
    kind: 'partner',
    partner: 'boink',
    title: 'Follow @boinkverse on X',
    description:
      'Follow Boink on X to keep up with announcements and community news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=boinkverse',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-boinkverse',
  },
  {
    slug: 'boink-complete-daily-quest',
    kind: 'partner',
    partner: 'boink',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 3,
    verifier: 'any-daily-quest',
  },
  // Inky Squad
  {
    slug: 'inky-squad-hold-inky-squad',
    kind: 'partner',
    partner: 'inky-squad',
    title: 'Hold an Inky Squad NFT',
    description: 'Hold at least one Inky Squad NFT in your wallet.',
    actionUrl: 'https://opensea.io/collection/inkysquad',
    points: 0,
    sortOrder: 1,
    verifier: 'hold-inky-squad',
  },
  {
    slug: 'inky-squad-follow-squidsonink',
    kind: 'partner',
    partner: 'inky-squad',
    title: 'Follow @squidsonink on X',
    description:
      'Follow Inky Squad on X to keep up with announcements and community news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=squidsonink',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-squidsonink',
  },
  {
    slug: 'inky-squad-complete-daily-quest',
    kind: 'partner',
    partner: 'inky-squad',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 3,
    verifier: 'any-daily-quest',
  },
  // Nado
  {
    slug: 'nado-follow-nadohq',
    kind: 'partner',
    partner: 'nado',
    title: 'Follow @nadoHQ on X',
    description:
      'Follow Nado on X to keep up with announcements and community news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=nadoHQ',
    points: 0,
    sortOrder: 1,
    verifier: 'x-follow-nadohq',
  },
  {
    slug: 'nado-trade-futures',
    kind: 'partner',
    partner: 'nado',
    title: 'Trade futures on Nado',
    description:
      "Make any futures (perps) trade on Nado. Nado's stats can take up to 20 minutes to update.",
    actionUrl: NADO_URL,
    points: 0,
    sortOrder: 2,
    verifier: 'nado-perp-trade',
  },
  {
    slug: 'nado-explore-arcade',
    kind: 'partner',
    partner: 'nado',
    title: 'Explore Nado Arcade',
    description: 'Open Nado Arcade and take a look around.',
    actionUrl: 'https://arcade.nado.xyz/',
    points: 0,
    sortOrder: 3,
    verifier: 'visit-nado-arcade',
  },
  {
    slug: 'nado-complete-daily-quest',
    kind: 'partner',
    partner: 'nado',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 4,
    verifier: 'any-daily-quest',
  },
  // Tydro
  {
    slug: 'tydro-follow-tydrohq',
    kind: 'partner',
    partner: 'tydro',
    title: 'Follow @tydrohq on X',
    description:
      'Follow Tydro on X to keep up with announcements and community news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=tydrohq',
    points: 0,
    sortOrder: 1,
    verifier: 'x-follow-tydrohq',
  },
  {
    // Same check as the daily ETH supply quest, with its own minimum.
    slug: 'tydro-supply-weth-20usd',
    kind: 'partner',
    partner: 'tydro',
    title: 'Supply $20 of ETH on Tydro',
    description:
      'Supply at least $20 of ETH (or WETH) to the Tydro lending market in one transaction.',
    actionUrl: TYDRO_WETH_URL,
    points: 0,
    sortOrder: 2,
    verifier: 'tydro-supply-weth',
    minUsd: 20,
  },
  {
    slug: 'tydro-complete-daily-quest',
    kind: 'partner',
    partner: 'tydro',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 3,
    verifier: 'any-daily-quest',
  },
  // INKverse
  {
    slug: 'inkverse-hold-inkverse',
    kind: 'partner',
    partner: 'inkverse',
    title: 'Hold an INKverse NFT',
    description: 'Hold at least one INKverse NFT in your wallet.',
    actionUrl: 'https://opensea.io/collection/inkverse-920024436',
    points: 0,
    sortOrder: 1,
    verifier: 'hold-inkverse',
  },
  {
    slug: 'inkverse-follow-0x-snatch',
    kind: 'partner',
    partner: 'inkverse',
    title: 'Follow @0x_snatch on X',
    description: 'Follow the artist behind INKverse on X.',
    actionUrl: 'https://x.com/intent/follow?screen_name=0x_snatch',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-0x-snatch',
  },
  {
    slug: 'inkverse-explore',
    kind: 'partner',
    partner: 'inkverse',
    title: 'Explore INKverse',
    description: 'Open the INKverse gallery and take a look around.',
    actionUrl: 'https://inkside.fun/inkverse',
    points: 0,
    sortOrder: 3,
    verifier: 'visit-inkverse',
  },
  {
    slug: 'inkverse-complete-daily-quest',
    kind: 'partner',
    partner: 'inkverse',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 4,
    verifier: 'any-daily-quest',
  },
  // Ink Bunnies
  {
    slug: 'ink-bunnies-hold-ink-bunnies',
    kind: 'partner',
    partner: 'ink-bunnies',
    title: 'Hold an Ink Bunnies NFT',
    description:
      'Hold at least one Ink Bunnies NFT in your wallet or staked on stake.inkbunnies.xyz.',
    actionUrl: 'https://opensea.io/collection/inkbunnies',
    points: 0,
    sortOrder: 1,
    verifier: 'hold-ink-bunnies',
  },
  {
    slug: 'ink-bunnies-follow-inkbunniesnft',
    kind: 'partner',
    partner: 'ink-bunnies',
    title: 'Follow @InkBunniesNFT on X',
    description:
      'Follow Ink Bunnies on X to keep up with announcements and community news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=InkBunniesNFT',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-inkbunniesnft',
  },
  {
    slug: 'ink-bunnies-complete-daily-quest',
    kind: 'partner',
    partner: 'ink-bunnies',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 3,
    verifier: 'any-daily-quest',
  },
  // Krak Mask
  {
    slug: 'krak-mask-follow-krakmask',
    kind: 'partner',
    partner: 'krak-mask',
    title: 'Follow @KrakMask on X',
    description: 'Follow Krak Mask on X for the daily memes and news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=KrakMask',
    points: 0,
    sortOrder: 1,
    verifier: 'x-follow-krakmask',
  },
  {
    slug: 'krak-mask-hold-10k-krakmask',
    kind: 'partner',
    partner: 'krak-mask',
    title: 'Hold 10,000 KRAKMASK',
    description: 'Hold at least 10,000 KRAKMASK tokens in your wallet.',
    actionUrl:
      'https://inkypump.com/ink/trade/0x32bCB803f696C99Eb263D60a05CAfD8689026575',
    points: 0,
    sortOrder: 2,
    verifier: 'hold-krakmask-10k',
  },
  {
    slug: 'krak-mask-explore-krak-heads',
    kind: 'partner',
    partner: 'krak-mask',
    title: 'Explore Krak Heads',
    description:
      'Open the Krak Heads collection on OpenSea and take a look around.',
    actionUrl: 'https://opensea.io/collection/krak-heads-285086705',
    points: 0,
    sortOrder: 3,
    verifier: 'visit-krak-heads',
  },
  {
    slug: 'krak-mask-complete-daily-quest',
    kind: 'partner',
    partner: 'krak-mask',
    title: 'Complete any daily quest',
    description: "Finish any of today's daily quests on the home page.",
    actionUrl: '/',
    points: 0,
    sortOrder: 4,
    verifier: 'any-daily-quest',
  },
  // xStocks
  {
    slug: 'xstocks-join-xpoints',
    kind: 'partner',
    partner: 'xstocks',
    title: 'Join xStocks xPoints',
    description:
      'Open the xPoints page and connect your wallet to start earning points for your xStocks.',
    actionUrl: 'https://defi.xstocks.fi/points?ref=INKQUESTS',
    points: 0,
    sortOrder: 1,
    verifier: 'visit-xstocks-points',
  },
  {
    slug: 'xstocks-follow-xstocksfi',
    kind: 'partner',
    partner: 'xstocks',
    title: 'Follow @xStocksFi on X',
    description: 'Follow xStocks on X for new listings and xPoints news.',
    actionUrl: 'https://x.com/intent/follow?screen_name=xStocksFi',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-xstocksfi',
  },
  {
    slug: 'xstocks-hold-10usd-wspyx',
    kind: 'partner',
    partner: 'xstocks',
    title: 'Hold $10 of wSPYx',
    description:
      'Buy wSPYx, the S&P 500 xStock, and hold at least $10 of it in your wallet. Pay with USDG for the best price.',
    // Our referral code, on CoW Swap's Ink USDG → wSPYx page.
    actionUrl:
      'https://swap.cow.fi/?ref=INKQUESTS#/57073/swap/USDG/0xE7E553Cd128F0011777323A0b44a7b96EA1CB540',
    points: 0,
    sortOrder: 3,
    verifier: 'hold-wspyx-10usd',
  },
  // BOI Part 1: S.E.X.
  {
    slug: 'boi-1-join-referral',
    kind: 'partner',
    partner: 'boi-part-1',
    title: 'Join BOI with our referral',
    description:
      "Connect your wallet on BOI's Referrals page and confirm InkQuests as your referrer. It's one onchain transaction, filled in for you.",
    actionUrl: BOI_REFERRAL_URL,
    points: 0,
    // First, so the referral is set before the user does anything else.
    sortOrder: 1,
    // A nice-to-have: someone already referred by another wallet can't do it.
    optional: true,
    verifier: 'register-boi-referral',
  },
  {
    slug: 'boi-1-follow-boi-market',
    kind: 'partner',
    partner: 'boi-part-1',
    title: 'Follow @boi_market on X',
    description: 'Follow BOI Market on X for BOI news and updates.',
    actionUrl: 'https://x.com/intent/follow?screen_name=boi_market',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-boi-market',
  },
  {
    slug: 'boi-1-hold-boi',
    kind: 'partner',
    partner: 'boi-part-1',
    title: 'Hold a BOI',
    description:
      'Hold at least one BOI in your wallet. It pairs with a LadyBOI.',
    actionUrl: 'https://opensea.io/collection/boi-ink',
    points: 0,
    sortOrder: 3,
    verifier: 'hold-boi',
  },
  {
    slug: 'boi-1-hold-ladyboi',
    kind: 'partner',
    partner: 'boi-part-1',
    title: 'Hold a LadyBOI',
    description:
      'Hold at least one LadyBOI in your wallet. It pairs with a BOI.',
    actionUrl: 'https://opensea.io/collection/ladyboi',
    points: 0,
    sortOrder: 4,
    verifier: 'hold-ladyboi',
  },
  {
    slug: 'boi-1-sex',
    kind: 'partner',
    partner: 'boi-part-1',
    title: 'Start a S.E.X. event',
    description:
      'Pair your BOI with your LadyBOI on the S.E.X. page and start the event to birth a SmolBoi. It takes a small ETH fee.',
    actionUrl: `${BOI_WORK_URL}#sex`,
    points: 0,
    sortOrder: 5,
    verifier: 'sex-boi',
  },
  // BOI Part 2: Merge
  {
    slug: 'boi-2-join-referral',
    kind: 'partner',
    partner: 'boi-part-2',
    title: 'Join BOI with our referral',
    description:
      "Connect your wallet on BOI's Referrals page and confirm InkQuests as your referrer. Already did it in Part 1? Just verify.",
    actionUrl: BOI_REFERRAL_URL,
    points: 0,
    sortOrder: 1,
    // The same check as in Part 1, read from BOI's registry.
    optional: true,
    verifier: 'register-boi-referral',
  },
  {
    slug: 'boi-2-follow-boi-market',
    kind: 'partner',
    partner: 'boi-part-2',
    title: 'Follow @boi_market on X',
    description: 'Follow BOI Market on X for BOI news and updates.',
    actionUrl: 'https://x.com/intent/follow?screen_name=boi_market',
    points: 0,
    sortOrder: 2,
    verifier: 'x-follow-boi-market',
  },
  {
    slug: 'boi-2-hold-smolboi',
    kind: 'partner',
    partner: 'boi-part-2',
    title: 'Hold a SmolBoi',
    description:
      'Hold at least one SmolBoi in your wallet. To merge, you need two of the same level.',
    actionUrl: 'https://boi.market/collections/smolboi',
    points: 0,
    sortOrder: 3,
    verifier: 'hold-smolboi',
  },
  {
    slug: 'boi-2-merge',
    kind: 'partner',
    partner: 'boi-part-2',
    title: 'Merge your SmolBois',
    description:
      'Start a merge of two SmolBois of the same level on the Merge page. A success levels one up; an unshielded failure burns the fuel Smol.',
    actionUrl: `${BOI_WORK_URL}#merge`,
    points: 0,
    sortOrder: 4,
    verifier: 'merge-smolboi',
  },
];

type SeedChallenge = Omit<typeof challenges.$inferInsert, 'id' | 'createdAt'>;

// Challenges, each with its own leaderboard (see
// leaderboard/challenge.service.ts). Times are UTC; `endsAt` is exclusive.
// Only daily quests, check-ins and up to 5 referrals made during the
// challenge count, and only for wallets with a linked X account. Prizes are
// handed out by hand from the final standings.
const CHALLENGES: SeedChallenge[] = [
  {
    slug: 'challenge-2-inkverse',
    title: 'Leaderboard Challenge #2',
    // Oct 22 00:00 UTC through the Oct 28 23:59 UTC snapshot.
    startsAt: new Date('2026-10-22T00:00:00Z'),
    endsAt: new Date('2026-10-29T00:00:00Z'),
    places: 3,
    prize: '1 INKverse NFT',
    postUrl: 'https://x.com/inkquests/status/2112889305555235118',
    // First frames of the animated originals, in frontend/public/challenges.
    prizeItems: [
      {
        place: 2,
        name: 'INKverse #873',
        imageUrl: '/challenges/inkverse-873.webp',
        url: 'https://opensea.io/item/ink/0xfffbd67f37e1e9fd9d9ebef9b687daa72a33da64/873',
      },
      {
        place: 3,
        name: 'INKverse #428',
        imageUrl: '/challenges/inkverse-428.webp',
        url: 'https://opensea.io/item/ink/0xfffbd67f37e1e9fd9d9ebef9b687daa72a33da64/428',
      },
      {
        place: 1,
        name: 'INKverse #442',
        imageUrl: '/challenges/inkverse-442.webp',
        url: 'https://opensea.io/item/ink/0xfffbd67f37e1e9fd9d9ebef9b687daa72a33da64/442',
      },
    ],
  },
  {
    slug: 'challenge-3-boi',
    title: 'Leaderboard Challenge #3',
    // Nov 9 00:00 UTC through the Nov 15 23:59 UTC snapshot.
    startsAt: new Date('2026-11-09T00:00:00Z'),
    endsAt: new Date('2026-11-16T00:00:00Z'),
    places: 5,
    prize: '1 SmolBoi',
    // The announcement on X; set once it's posted.
    postUrl: null,
    // Same prize for every place, so no per-place cards; the prize's
    // picture is frontend/public/challenges/challenge-3-boi.png.
    prizeItems: null,
  },
];

// Fail before touching the DB instead of half-applying a broken catalog.
const validate = () => {
  const partnerSlugs = new Set(PARTNERS.map((p) => p.slug));
  const errors: string[] = [];

  for (const list of [PARTNERS, QUESTS, CHALLENGES]) {
    const seen = new Set<string>();
    for (const { slug } of list) {
      if (seen.has(slug)) errors.push(`duplicate slug "${slug}"`);
      seen.add(slug);
    }
  }

  for (const c of CHALLENGES) {
    const starts = new Date(c.startsAt).getTime();
    const ends = new Date(c.endsAt).getTime();
    if (Number.isNaN(starts) || Number.isNaN(ends) || ends <= starts) {
      errors.push(`challenge "${c.slug}": endsAt must be after startsAt`);
    }
    if (c.places < 1) errors.push(`challenge "${c.slug}": places must be 1+`);
  }

  for (const q of QUESTS) {
    if (q.kind === 'partner' && !q.partner) {
      errors.push(`quest "${q.slug}": partner quests need a partner`);
    }
    if (q.kind !== 'partner' && q.partner) {
      errors.push(`quest "${q.slug}": only partner quests have a partner`);
    }
    if (q.verifier && !(q.verifier in VERIFIERS)) {
      errors.push(`quest "${q.slug}": unknown verifier "${q.verifier}"`);
    }
    if (q.partner && !partnerSlugs.has(q.partner)) {
      errors.push(`quest "${q.slug}": unknown partner "${q.partner}"`);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid seed data:\n- ${errors.join('\n- ')}`);
  }
};

const toSnake = (s: string) =>
  s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

// On conflict, overwrite every column except the key and bookkeeping ones.
// A field left out of a seed entry resets to its column default.
const overwriteAll = (table: PgTable) =>
  Object.fromEntries(
    Object.keys(getTableColumns(table))
      .filter((c) => !['id', 'slug', 'createdAt'].includes(c))
      .map((c) => [c, sql.raw(`excluded.${toSnake(c)}`)]),
  );

async function main() {
  validate();

  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    await db.transaction(async (tx) => {
      const partnerRows = await tx
        .insert(partners)
        .values(PARTNERS)
        .onConflictDoUpdate({
          target: partners.slug,
          set: overwriteAll(partners),
        })
        .returning({ id: partners.id, slug: partners.slug });
      const partnerIds = new Map(partnerRows.map((p) => [p.slug, p.id]));

      await tx
        .update(partners)
        .set({ isActive: false })
        .where(notInArray(partners.slug, [...partnerIds.keys()]));

      await tx
        .insert(quests)
        .values(
          QUESTS.map(({ partner, ...q }) => ({
            ...q,
            partnerId: partner ? partnerIds.get(partner)! : null,
          })),
        )
        .onConflictDoUpdate({
          target: quests.slug,
          set: overwriteAll(quests),
        });

      await tx
        .update(quests)
        .set({ isActive: false })
        .where(
          notInArray(
            quests.slug,
            QUESTS.map((q) => q.slug),
          ),
        );

      // Removing a challenge from the list keeps its row, so past standings
      // stay; edit its dates instead to change it.
      if (CHALLENGES.length) {
        await tx
          .insert(challenges)
          .values(CHALLENGES)
          .onConflictDoUpdate({
            target: challenges.slug,
            set: overwriteAll(challenges),
          });
      }
    });

    console.log(
      `Seeded ${PARTNERS.length} partners, ${QUESTS.length} quests and ${CHALLENGES.length} challenges.`,
    );
  } finally {
    await pool.end();
  }
}

void main();
