// The quest catalog lives here, in code: edit the lists below and run
// `npm run db:seed`. Rows are matched by slug and every field is overwritten,
// so this file is the source of truth. A partner or quest removed from the
// file is deactivated, not deleted, because completions still point at it.
import { getTableColumns, notInArray, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { createDatabase } from './client';
import { partners, quests } from './schema';
import { loadEnvFile } from '../config/load-env-file';
import { VERIFIERS } from '../quests/verifiers';

loadEnvFile();

type SeedPartner = Omit<typeof partners.$inferInsert, 'id' | 'createdAt'>;

type SeedQuest = Omit<
  typeof quests.$inferInsert,
  'id' | 'createdAt' | 'partnerId'
> & {
  // Slug of the partner, required for kind 'partner'.
  partner?: string;
};

const PARTNERS: SeedPartner[] = [
  {
    slug: 'nado',
    title: 'Nado',
    description:
      'All-in-one CLOB DEX for spot, perps & money markets powered by unified margin. From the team that brought you Kraken.',
    imageUrl:
      'https://pbs.twimg.com/profile_banners/1947417601333989377/1763398031/1500x500',
  },
  {
    slug: 'tydro',
    title: 'Tydro',
    description:
      'A decentralized, non-custodial liquidity protocol built on Ink and powered by Aave.',
    imageUrl:
      'https://pbs.twimg.com/profile_banners/1927683015334928384/1755613697/1500x500',
  },
  {
    slug: 'inkyswap',
    title: 'InkySwap',
    description:
      "The decentralized exchange on Ink, where InkyPump's tokens get their liquidity once they reach the threshold. InkySwap handles the token trading and liquidity pools for Ink Network's DeFi ecosystem.",
    imageUrl:
      'https://pbs.twimg.com/profile_banners/1869047804196237312/1736419659/1500x500',
  },
];

// Amount quests come in $1 / $5 / $10 variants, each 10 XP more than the
// last. They share a group, so the daily rotation picks only one of them a
// day. The $1 variant keeps the original slug and its completion history.
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
}): SeedQuest[] =>
  AMOUNT_TIERS.map((usd, i) => ({
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
  }));

// The daily pool: each day shows 3 of these (see catalog/rotation.ts), from
// 3 different groups.
const QUESTS: SeedQuest[] = [
  {
    slug: 'daily-gm',
    kind: 'daily',
    title: 'Say GM',
    description: 'Say GM on the official platform.',
    actionUrl: 'https://gm.inkonchain.com/',
    points: 20,
    sortOrder: 1,
    verifier: 'ink-gm',
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
  }),
  ...tiered({
    slug: 'daily-tydro-supply-weth',
    title: (usd) => `Supply $${usd} of WETH on Tydro`,
    description: (usd) =>
      `Supply at least $${usd} of WETH (or ETH) to the Tydro lending market to complete this daily quest.`,
    actionUrl:
      'https://app.tydro.com/reserve-overview/?underlyingAsset=0x4200000000000000000000000000000000000006&marketName=proto_ink_v3',
    points: 30,
    sortOrder: 4,
    verifier: 'tydro-supply-weth',
  }),
  ...tiered({
    slug: 'daily-tydro-supply-usdt',
    title: (usd) => `Supply ${usd} USDT on Tydro`,
    description: (usd) =>
      `Supply at least ${usd} USDT to the Tydro lending market to complete this daily quest.`,
    actionUrl:
      'https://app.tydro.com/reserve-overview/?underlyingAsset=0x0200c29006150606b650577bbe7b6248f58470c1&marketName=proto_ink_v3',
    points: 30,
    sortOrder: 5,
    verifier: 'tydro-supply-usdt',
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
  }),
  {
    slug: 'daily-hold-templars-of-the-storm',
    kind: 'daily',
    title: 'Hold a Templars of the Storm NFT',
    description:
      'Hold at least one Templars of the Storm NFT in your wallet to claim this daily reward.',
    actionUrl: 'https://opensea.io/collection/templars-of-the-storm',
    points: 100,
    sortOrder: 6,
    verifier: 'hold-templars-of-the-storm',
  },
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
  },
];

// Fail before touching the DB instead of half-applying a broken catalog.
const validate = () => {
  const partnerSlugs = new Set(PARTNERS.map((p) => p.slug));
  const errors: string[] = [];

  for (const list of [PARTNERS, QUESTS]) {
    const seen = new Set<string>();
    for (const { slug } of list) {
      if (seen.has(slug)) errors.push(`duplicate slug "${slug}"`);
      seen.add(slug);
    }
  }

  for (const q of QUESTS) {
    if (q.kind === 'partner' && !q.partner) {
      errors.push(`quest "${q.slug}": partner quests need a partner`);
    }
    if (q.kind === 'daily' && q.partner) {
      errors.push(`quest "${q.slug}": daily quests can't have a partner`);
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
    });

    console.log(
      `Seeded ${PARTNERS.length} partners and ${QUESTS.length} quests.`,
    );
  } finally {
    await pool.end();
  }
}

void main();
