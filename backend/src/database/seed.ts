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
  {
    slug: 'daily-inkyswap-swap',
    kind: 'daily',
    title: 'Swap on InkySwap',
    description: 'Make a simple swap on InkySwap to complete this daily quest.',
    actionUrl: 'https://inkyswap.com/swap',
    points: 30,
    sortOrder: 2,
  },
  {
    slug: 'daily-superbridge',
    kind: 'daily',
    title: 'Bridge to Ink using Superbridge',
    description:
      'Bridge assets to Ink using Superbridge and keep your streak alive.',
    actionUrl: 'https://superbridge.app/?fromChainId=1&toChainId=57073',
    points: 40,
    sortOrder: 3,
  },
  {
    slug: 'daily-tydro-supply-weth',
    kind: 'daily',
    title: 'Supply WETH on Tydro',
    description:
      'Supply at least $1 of WETH (or ETH) to the Tydro lending market to complete this daily quest.',
    actionUrl:
      'https://app.tydro.com/reserve-overview/?underlyingAsset=0x4200000000000000000000000000000000000006&marketName=proto_ink_v3',
    points: 30,
    sortOrder: 4,
    verifier: 'tydro-supply-weth',
  },
  {
    slug: 'daily-tydro-supply-usdt',
    kind: 'daily',
    title: 'Supply USDT on Tydro',
    description:
      'Supply at least 1 USDT to the Tydro lending market to complete this daily quest.',
    actionUrl:
      'https://app.tydro.com/reserve-overview/?underlyingAsset=0x0200c29006150606b650577bbe7b6248f58470c1&marketName=proto_ink_v3',
    points: 30,
    sortOrder: 5,
    verifier: 'tydro-supply-usdt',
  },
  {
    slug: 'daily-relay-bridge',
    kind: 'daily',
    title: 'Bridge to Ink with Relay',
    description:
      'Bridge at least $1 to Ink from Ethereum, Base, Arbitrum or Robinhood Chain with Relay.',
    actionUrl: 'https://relay.link/bridge/ink',
    points: 50,
    sortOrder: 9,
    verifier: 'relay-bridge-to-ink',
  },
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
