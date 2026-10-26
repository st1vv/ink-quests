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
type PartnerTag = 'NFT' | 'Token' | 'Perp DEX' | 'Lending';

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
  | 'Social';

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
    description: 'Send a GM to the InkQuests wallet on the official platform.',
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
      'Hold at least one INK Bunnies NFT in your wallet to claim this daily reward.',
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
      'Hold at least one Boink NFT in your wallet to claim this daily reward.',
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
    description: 'Hold at least one Boink NFT in your wallet.',
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
];

type SeedChallenge = Omit<typeof challenges.$inferInsert, 'id' | 'createdAt'>;

// Weekly challenges, each with its own leaderboard (see
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
