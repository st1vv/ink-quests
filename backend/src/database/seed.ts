// Upserts the starter quest catalog (moved from the frontend's hardcoded data).
// Run with: npm run db:seed
import { sql } from 'drizzle-orm';
import { createDatabase } from './client';
import { partners, quests } from './schema';
import { loadEnvFile } from '../config/load-env-file';

loadEnvFile();

const PARTNERS: (typeof partners.$inferInsert)[] = [
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

const DAILY_QUESTS: (typeof quests.$inferInsert)[] = [
  {
    slug: 'daily-gm',
    kind: 'daily',
    title: 'Say GM',
    description: 'Say GM on the official platform.',
    actionUrl: 'https://gm.inkonchain.com/',
    points: 20,
    sortOrder: 1,
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
];

// On conflict, overwrite the given columns with the incoming row values.
const excludedAll = (columns: string[]) =>
  Object.fromEntries(
    columns.map((c) => [c, sql.raw(`excluded.${toSnake(c)}`)]),
  );
const toSnake = (s: string) =>
  s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

async function main() {
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    await db
      .insert(partners)
      .values(PARTNERS)
      .onConflictDoUpdate({
        target: partners.slug,
        set: excludedAll(['title', 'description', 'imageUrl']),
      });

    await db
      .insert(quests)
      .values(DAILY_QUESTS)
      .onConflictDoUpdate({
        target: quests.slug,
        set: excludedAll([
          'title',
          'description',
          'actionUrl',
          'points',
          'sortOrder',
        ]),
      });

    console.log(
      `Seeded ${PARTNERS.length} partners and ${DAILY_QUESTS.length} daily quests.`,
    );
  } finally {
    await pool.end();
  }
}

void main();
