import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { userXp } from '../leaderboard/leaderboard.service';

// How far back the daily series go; 'all' starts at the first signup.
export const GROWTH_RANGES = ['30', '90', 'all'] as const;
export type GrowthRange = (typeof GROWTH_RANGES)[number];

// Weekly signup cohorts shown, newest last.
const COHORT_WEEKS = 12;

// A user is active on a UTC day when they check in, complete a quest (a
// partner task too) or finish a partner campaign that day.
const activity = sql`
  select user_id, day from check_ins
  union
  select user_id, (completed_at at time zone 'UTC')::date from quest_completions
  union
  select user_id, (created_at at time zone 'UTC')::date from campaign_rewards
`;

// Days with an action proven by a transaction (see statistics.service).
const onchainDays = sql`
  select user_id, (completed_at at time zone 'UTC')::date as day
  from quest_completions where tx_hash is not null
  union
  select user_id, day from check_ins where tx_hash is not null
`;

const today = sql`(now() at time zone 'UTC')::date`;
const signupDay = sql`(created_at at time zone 'UTC')::date`;

type DayRow = {
  day: string;
  new_users: number;
  referred: number;
  active: number;
  onchain: number;
};

type TotalsRow = {
  users: number;
  referred: number;
  x_linked: number;
  with_xp: number;
  returned: number;
  regulars: number;
  onchain: number;
};

type CohortRow = { week: string; size: number };
type CohortActivityRow = { week: string; week_offset: number; active: number };

// Admin growth charts: are new users coming, do they come back, and how
// far they get. Days and weeks are UTC; weeks start on Monday.
@Injectable()
export class GrowthService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async growth(range: GrowthRange) {
    const start =
      range === 'all'
        ? sql`coalesce((select min(${signupDay}) from users), ${today})`
        : sql`${today} - ${Number(range) - 1}::int`;

    const [days, totals, cohorts, cohortActivity] = await Promise.all([
      this.db.execute<DayRow>(sql`
        with
          series as (
            select generate_series(${start}, ${today}, interval '1 day')::date
              as day
          ),
          signups as (
            select ${signupDay} as day, count(*)::int as new_users,
              count(referred_by_id)::int as referred
            from users group by 1
          ),
          active as (
            select day, count(distinct user_id)::int as active
            from (${activity}) a group by 1
          ),
          onchain as (
            select day, count(distinct user_id)::int as onchain
            from (${onchainDays}) o group by 1
          )
        select s.day::text as day,
          coalesce(su.new_users, 0) as new_users,
          coalesce(su.referred, 0) as referred,
          coalesce(a.active, 0) as active,
          coalesce(o.onchain, 0) as onchain
        from series s
        left join signups su on su.day = s.day
        left join active a on a.day = s.day
        left join onchain o on o.day = s.day
        order by s.day
      `),
      this.db.execute<TotalsRow>(sql`
        with active_days as (
          select user_id, count(*)::int as days
          from (${activity}) a group by 1
        )
        select
          (select count(*)::int from users) as users,
          (select count(referred_by_id)::int from users) as referred,
          (select count(x_user_id)::int from users) as x_linked,
          (select count(*)::int from (${userXp}) x) as with_xp,
          (select count(*)::int from active_days where days >= 2) as returned,
          (select count(*)::int from active_days where days >= 7) as regulars,
          (select count(distinct user_id)::int from (${onchainDays}) o)
            as onchain
      `),
      this.db.execute<CohortRow>(sql`
        select date_trunc('week', ${signupDay})::date::text as week,
          count(*)::int as size
        from users
        group by 1 order by 1 desc limit ${COHORT_WEEKS}
      `),
      // Distinct cohort users active in each week since their signup week
      // (offset 0 is the signup week itself).
      this.db.execute<CohortActivityRow>(sql`
        select date_trunc('week', ${signupDay})::date::text as week,
          ((date_trunc('week', a.day)::date
            - date_trunc('week', ${signupDay})::date) / 7)::int as week_offset,
          count(distinct a.user_id)::int as active
        from users u
        join (${activity}) a on a.user_id = u.id
        group by 1, 2
      `),
    ]);

    const t = totals.rows[0];
    const thisWeek = startOfUtcWeek(new Date());

    return {
      days: days.rows.map((d) => ({
        day: d.day,
        newUsers: d.new_users,
        referred: d.referred,
        active: d.active,
        onchain: d.onchain,
      })),
      totals: {
        users: t.users,
        referred: t.referred,
        xLinked: t.x_linked,
        withXp: t.with_xp,
        // Active on 2+ and 7+ different days.
        returned: t.returned,
        regulars: t.regulars,
        onchain: t.onchain,
      },
      // Oldest first; active[k] is how many of the cohort were active k
      // weeks after their signup week, up to the current week.
      cohorts: cohorts.rows.reverse().map((c) => {
        const weeks = Math.round((thisWeek - Date.parse(c.week)) / WEEK_MS);
        const active = Array.from({ length: weeks + 1 }, () => 0);
        for (const r of cohortActivity.rows) {
          if (r.week === c.week && r.week_offset <= weeks)
            active[r.week_offset] = r.active;
        }
        return { week: c.week, size: c.size, active };
      }),
    };
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Monday 00:00 UTC of the current week, in ms.
const startOfUtcWeek = (now: Date) => {
  const day = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return day - ((now.getUTCDay() + 6) % 7) * (WEEK_MS / 7);
};
