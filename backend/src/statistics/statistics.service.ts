import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { getAddress } from 'viem';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { userXp } from '../leaderboard/leaderboard.service';
import { levelForXp } from '../progress/level';

export const STATS_PAGE_SIZE = 50;

// The lists behind the stat cards, one per card.
export const STATS_VIEWS = [
  'users',
  'users-with-xp',
  'quests',
  'daily-quests',
  'partner-quests',
  'check-ins',
  'transactions',
  'transaction-wallets',
] as const;
export type StatsView = (typeof STATS_VIEWS)[number];

type StatsRow = {
  users: number;
  users_with_xp: number;
  daily_quests: number;
  partner_quests: number;
  check_ins: number;
  transactions: number;
  tx_users: number;
};

// A raw row: every list has the wallet's address; the rest depends on it.
type ListRow = { address: string } & Record<string, unknown>;

type ListSpec = {
  // One row per list item, with an `address` column for the wallet filter.
  query: SQL;
  orderBy: SQL;
  toItem: (row: ListRow) => Record<string, unknown>;
};

// Raw SQL returns timestamps as Postgres text.
const iso = (value: unknown) =>
  value === null ? null : new Date(value as string).toISOString();

// Daily quest completions and finished partner quests (campaign rewards),
// in one shape. A partner quest counts once its whole campaign is done; its
// single tasks don't show here.
const dailyCompletions = sql`
  select
    'q' || c.id as id, u.address, u.display_name, q.title as quest,
    'daily' as kind,
    null::text as partner, c.points, c.tx_hash, c.completed_at
  from quest_completions c
  join users u on u.id = c.user_id
  join quests q on q.id = c.quest_id
  where q.kind = 'daily'
`;
const partnerCompletions = sql`
  select
    'c' || cr.id as id, u.address, u.display_name, p.title as quest,
    'partner' as kind,
    null::text as partner, cr.points, null::text as tx_hash,
    cr.created_at as completed_at
  from campaign_rewards cr
  join users u on u.id = cr.user_id
  join partners p on p.id = cr.partner_id
`;
const completionOrder = sql`completed_at desc, id desc`;

const toCompletion = (r: ListRow) => ({
  id: r.id,
  address: getAddress(r.address),
  name: r.display_name,
  quest: r.quest,
  kind: r.kind,
  // Campaign title for a partner task.
  partner: r.partner,
  points: r.points,
  txHash: r.tx_hash,
  completedAt: iso(r.completed_at),
});

const LISTS: Record<StatsView, ListSpec> = {
  users: {
    query: sql`
      select
        u.id, u.address, u.display_name, coalesce(x.xp, 0)::int as xp,
        u.created_at, u.last_login_at, r.address as referrer,
        r.display_name as referrer_name,
        (select count(*)::int from users i where i.referred_by_id = u.id)
          as referrals,
        (select count(*)::int from referral_rewards rr
          where rr.referrer_id = u.id) as rewarded_referrals
      from users u
      left join (${userXp}) x on x.user_id = u.id
      left join users r on r.id = u.referred_by_id
    `,
    orderBy: sql`created_at desc, id desc`,
    toItem: (r) => ({
      id: r.id,
      address: getAddress(r.address),
      name: r.display_name,
      xp: r.xp,
      level: levelForXp(r.xp as number),
      createdAt: iso(r.created_at),
      lastLoginAt: iso(r.last_login_at),
      referrer: r.referrer ? getAddress(r.referrer as string) : null,
      referrerName: r.referrer_name,
      // Users they invited, and how many of those paid them a referral
      // reward (did an onchain quest).
      referrals: r.referrals,
      rewardedReferrals: r.rewarded_referrals,
    }),
  },

  // Every wallet with XP, our own included (unlike the leaderboard). The
  // rank is taken before the wallet filter, so it stays the overall one.
  'users-with-xp': {
    query: sql`
      select
        u.id, u.address, u.display_name, x.xp, x.reached_at,
        row_number() over (
          order by x.xp desc, x.reached_at asc, u.id asc
        )::int as rank
      from (${userXp}) x
      join users u on u.id = x.user_id
    `,
    orderBy: sql`rank`,
    toItem: (r) => ({
      id: r.id,
      rank: r.rank,
      address: getAddress(r.address),
      name: r.display_name,
      xp: r.xp,
      level: levelForXp(r.xp as number),
      lastXpAt: iso(r.reached_at),
    }),
  },

  quests: {
    query: sql`${dailyCompletions} union all ${partnerCompletions}`,
    orderBy: completionOrder,
    toItem: toCompletion,
  },
  'daily-quests': {
    query: dailyCompletions,
    orderBy: completionOrder,
    toItem: toCompletion,
  },
  'partner-quests': {
    query: partnerCompletions,
    orderBy: completionOrder,
    toItem: toCompletion,
  },

  'check-ins': {
    query: sql`
      select
        ci.id, u.address, u.display_name, ci.day::text as day, ci.points, ci.bonus_points,
        ci.created_at
      from check_ins ci
      join users u on u.id = ci.user_id
    `,
    orderBy: sql`created_at desc, id desc`,
    toItem: (r) => ({
      id: r.id,
      address: getAddress(r.address),
      name: r.display_name,
      day: r.day,
      points: r.points,
      bonusPoints: r.bonus_points,
      createdAt: iso(r.created_at),
    }),
  },

  // Quest completions proven by an onchain transaction, partner tasks too.
  transactions: {
    query: sql`
      select
        'q' || c.id as id, u.address, u.display_name, q.title as quest,
        q.kind::text as kind,
        p.title as partner, c.points, c.tx_hash, c.completed_at
      from quest_completions c
      join users u on u.id = c.user_id
      join quests q on q.id = c.quest_id
      left join partners p on p.id = q.partner_id
      where c.tx_hash is not null
    `,
    orderBy: completionOrder,
    toItem: toCompletion,
  },

  'transaction-wallets': {
    query: sql`
      select
        u.id, u.address, u.display_name, count(*)::int as transactions,
        sum(c.points)::int as xp, max(c.completed_at) as last_tx_at
      from quest_completions c
      join users u on u.id = c.user_id
      where c.tx_hash is not null
      group by u.id
    `,
    orderBy: sql`last_tx_at desc, id desc`,
    toItem: (r) => ({
      id: r.id,
      address: getAddress(r.address),
      name: r.display_name,
      transactions: r.transactions,
      xp: r.xp,
      lastTxAt: iso(r.last_tx_at),
    }),
  },
};

@Injectable()
export class StatisticsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async stats() {
    const { rows } = await this.db.execute<StatsRow>(sql`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from (${userXp}) x) as users_with_xp,
        (count(*) filter (where q.kind = 'daily'))::int as daily_quests,
        (select count(*)::int from campaign_rewards) as partner_quests,
        (select count(*)::int from check_ins) as check_ins,
        (count(*) filter (where c.tx_hash is not null))::int as transactions,
        (count(distinct c.user_id) filter (where c.tx_hash is not null))::int
          as tx_users
      from quest_completions c
      join quests q on q.id = c.quest_id
    `);

    const s = rows[0];
    return {
      users: s.users,
      usersWithXp: s.users_with_xp,
      // A partner quest counts once its whole campaign is done; its single
      // tasks don't count.
      questsCompleted: s.daily_quests + s.partner_quests,
      dailyQuestsCompleted: s.daily_quests,
      partnerQuestsCompleted: s.partner_quests,
      checkIns: s.check_ins,
      transactions: s.transactions,
      transactionUsers: s.tx_users,
    };
  }

  // One page of the list behind a stat card, in its own order. `address`
  // narrows it to one wallet.
  async list(view: StatsView, page: number, address?: string) {
    const { query, orderBy, toItem } = LISTS[view];
    const where = address
      ? sql`where l.address = ${address.toLowerCase()}`
      : sql.empty();

    const [counted, listed] = await Promise.all([
      this.db.execute<{ total: number }>(
        sql`select count(*)::int as total from (${query}) l ${where}`,
      ),
      this.db.execute<ListRow>(sql`
        select * from (${query}) l ${where}
        order by ${orderBy}
        limit ${STATS_PAGE_SIZE} offset ${(page - 1) * STATS_PAGE_SIZE}
      `),
    ]);

    return {
      total: counted.rows[0].total,
      page,
      pageSize: STATS_PAGE_SIZE,
      items: listed.rows.map(toItem),
    };
  }
}
