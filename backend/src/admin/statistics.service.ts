import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, sql, type SQL } from 'drizzle-orm';
import { getAddress } from 'viem';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { users } from '../database/schema';
import { userXp } from '../leaderboard/leaderboard.service';
import { ProfileService } from '../profile/profile.service';
import { levelForXp } from '../progress/level';

export const STATS_PAGE_SIZE = 50;

// The lists behind the stat cards, one per card.
export const STATS_VIEWS = [
  'users',
  'users-with-xp',
  'quests',
  'daily-quests',
  'social-quests',
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
  social_quests: number;
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

// Social quests are daily quests tagged Social (X, Telegram); the stats
// count them apart from the other daily quests. `q` is the quests row.
const isSocial = sql`'Social' = any(q.tags)`;
const questKind = sql`
  case when q.kind = 'daily' and ${isSocial} then 'social' else q.kind::text end
`;

// Daily and social quest completions and finished partner quests (campaign
// rewards), in one shape. A partner quest counts once its whole campaign is
// done; its single tasks don't show here. partner_slug is for the campaign
// filter.
const questCompletions = (social: boolean) => sql`
  select
    'q' || c.id as id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked, q.title as quest,
    ${questKind} as kind,
    null::text as partner, c.points, c.tx_hash, c.completed_at,
    null::text as partner_slug
  from quest_completions c
  join users u on u.id = c.user_id
  join quests q on q.id = c.quest_id
  where q.kind = 'daily' and ${social ? isSocial : sql`not ${isSocial}`}
`;
const dailyCompletions = questCompletions(false);
const socialCompletions = questCompletions(true);
const partnerCompletions = sql`
  select
    'c' || cr.id as id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked, p.title as quest,
    'partner' as kind,
    null::text as partner, cr.points, null::text as tx_hash,
    cr.created_at as completed_at,
    p.slug as partner_slug
  from campaign_rewards cr
  join users u on u.id = cr.user_id
  join partners p on p.id = cr.partner_id
`;
const completionOrder = sql`completed_at desc, id desc`;

const toCompletion = (r: ListRow) => ({
  id: r.id,
  address: getAddress(r.address),
  name: r.display_name,
  xUsername: r.x_username,
  // The linked Telegram account; the username is null when it has none.
  telegramUsername: r.telegram_username,
  telegramLinked: r.telegram_linked,
  quest: r.quest,
  kind: r.kind,
  // Campaign title for a partner task.
  partner: r.partner,
  points: r.points,
  txHash: r.tx_hash,
  completedAt: iso(r.completed_at),
});

// Users the wallet invited, and how many of those paid it a referral reward
// (`u` is the wallet's users row).
const referralCounts = sql`
  (select count(*)::int from users i where i.referred_by_id = u.id)
    as referrals,
  (select count(*)::int from referral_rewards rr
    where rr.referrer_id = u.id) as rewarded_referrals
`;

// Every action proven by a transaction: quest completions with one, and
// paid check-ins.
const onchainActions = sql`
  select user_id, points, tx_hash, completed_at as at
  from quest_completions
  where tx_hash is not null
  union all
  select user_id, points + bonus_points, tx_hash, created_at
  from check_ins
  where tx_hash is not null
`;

const LISTS: Record<StatsView, ListSpec> = {
  users: {
    query: sql`
      select
        u.id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked,
        coalesce(x.xp, 0)::int as xp,
        u.created_at, u.last_login_at, r.address as referrer,
        r.display_name as referrer_name,
        ${referralCounts}
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
      // The linked X handle, without the @.
      xUsername: r.x_username,
      // The linked Telegram account; the username is null when it has none.
      telegramUsername: r.telegram_username,
      telegramLinked: r.telegram_linked,
    }),
  },

  // Every wallet with XP, our own included (unlike the leaderboard). The
  // rank is taken before the wallet filter, so it stays the overall one.
  'users-with-xp': {
    query: sql`
      select
        u.id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked, x.xp, x.reached_at,
        ${referralCounts},
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
      referrals: r.referrals,
      rewardedReferrals: r.rewarded_referrals,
      xUsername: r.x_username,
      // The linked Telegram account; the username is null when it has none.
      telegramUsername: r.telegram_username,
      telegramLinked: r.telegram_linked,
    }),
  },

  quests: {
    query: sql`
      ${dailyCompletions}
      union all ${socialCompletions}
      union all ${partnerCompletions}
    `,
    orderBy: completionOrder,
    toItem: toCompletion,
  },
  'daily-quests': {
    query: dailyCompletions,
    orderBy: completionOrder,
    toItem: toCompletion,
  },
  'social-quests': {
    query: socialCompletions,
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
        ci.id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked, ci.day::text as day, ci.points, ci.bonus_points,
        ci.tx_hash,
        ci.created_at
      from check_ins ci
      join users u on u.id = ci.user_id
    `,
    orderBy: sql`created_at desc, id desc`,
    toItem: (r) => ({
      id: r.id,
      address: getAddress(r.address),
      name: r.display_name,
      xUsername: r.x_username,
      // The linked Telegram account; the username is null when it has none.
      telegramUsername: r.telegram_username,
      telegramLinked: r.telegram_linked,
      day: r.day,
      points: r.points,
      bonusPoints: r.bonus_points,
      createdAt: iso(r.created_at),
      // The paid check-in's transaction; null for free ones.
      txHash: r.tx_hash,
    }),
  },

  // Everything proven by an onchain transaction: quest completions
  // (partner tasks too) and paid check-ins.
  transactions: {
    query: sql`
      select
        'q' || c.id as id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked, q.title as quest,
        ${questKind} as kind,
        p.title as partner, c.points, c.tx_hash, c.completed_at
      from quest_completions c
      join users u on u.id = c.user_id
      join quests q on q.id = c.quest_id
      left join partners p on p.id = q.partner_id
      where c.tx_hash is not null
      union all
      select
        'k' || ci.id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked,
        'Daily check-in', 'check-in', null, ci.points + ci.bonus_points,
        ci.tx_hash, ci.created_at
      from check_ins ci
      join users u on u.id = ci.user_id
      where ci.tx_hash is not null
    `,
    orderBy: completionOrder,
    toItem: toCompletion,
  },

  'transaction-wallets': {
    query: sql`
      select
        u.id, u.address, u.display_name, u.x_username, u.telegram_username,
    (u.telegram_user_id is not null) as telegram_linked,
        count(*)::int as transactions, sum(o.points)::int as xp,
        max(o.at) as last_tx_at
      from (${onchainActions}) o
      join users u on u.id = o.user_id
      group by u.id
    `,
    orderBy: sql`last_tx_at desc, id desc`,
    toItem: (r) => ({
      id: r.id,
      address: getAddress(r.address),
      name: r.display_name,
      xUsername: r.x_username,
      // The linked Telegram account; the username is null when it has none.
      telegramUsername: r.telegram_username,
      telegramLinked: r.telegram_linked,
      transactions: r.transactions,
      xp: r.xp,
      lastTxAt: iso(r.last_tx_at),
    }),
  },
};

@Injectable()
export class StatisticsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly profile: ProfileService,
  ) {}

  // One page of everything a wallet did, newest first, for the admin user
  // page. Not a 404 for an unknown wallet: the admin pages read 404 as "not
  // an admin".
  async userActivity(address: string, page: number) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.address, address.toLowerCase()));
    if (!user) throw new BadRequestException('No user with this address');
    return this.profile.activityPage(user.id, page);
  }

  async stats() {
    const { rows } = await this.db.execute<StatsRow>(sql`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from (${userXp}) x) as users_with_xp,
        (count(*) filter (where q.kind = 'daily' and not ${isSocial}))::int
          as daily_quests,
        (count(*) filter (where q.kind = 'daily' and ${isSocial}))::int
          as social_quests,
        (select count(*)::int from campaign_rewards) as partner_quests,
        (select count(*)::int from check_ins) as check_ins,
        (select count(*)::int from (${onchainActions}) o) as transactions,
        (select count(distinct user_id)::int from (${onchainActions}) o)
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
      questsCompleted: s.daily_quests + s.social_quests + s.partner_quests,
      // Daily quests without the social ones, which count on their own.
      dailyQuestsCompleted: s.daily_quests,
      socialQuestsCompleted: s.social_quests,
      partnerQuestsCompleted: s.partner_quests,
      checkIns: s.check_ins,
      transactions: s.transactions,
      transactionUsers: s.tx_users,
    };
  }

  // One page of the list behind a stat card, in its own order. `address`
  // narrows it to one wallet, `partner` (a campaign slug) the partner quests
  // to one campaign.
  async list(
    view: StatsView,
    page: number,
    { address, partner }: { address?: string; partner?: string } = {},
  ) {
    const { query, orderBy, toItem } = LISTS[view];
    const conditions = [
      address && sql`l.address = ${address.toLowerCase()}`,
      partner && sql`l.partner_slug = ${partner}`,
    ].filter((c): c is SQL => Boolean(c));
    const where = conditions.length
      ? sql`where ${sql.join(conditions, sql` and `)}`
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
