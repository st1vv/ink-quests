import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { getAddress } from 'viem';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { levelForXp } from '../progress/level';

export const LEADERBOARD_SIZE = 100;

// Total XP per user from quests, check-ins, referrals and campaign rewards,
// the same sum as GET /me/progress. Only users with any XP get a row.
export const userXp = sql`
  select
    user_id,
    sum(points)::int as xp,
    max(earned_at) filter (where points > 0) as reached_at
  from (
    select user_id, points, completed_at as earned_at from quest_completions
    union all
    select user_id, points + bonus_points, created_at from check_ins
    union all
    select referrer_id, points, created_at from referral_rewards
    union all
    select user_id, points, created_at from campaign_rewards
  ) p
  group by user_id
  having sum(points) > 0
`;

// Every user with XP gets their own place: on equal XP, whoever reached it
// first (the earlier last XP-earning action) is ahead, then whoever signed
// up first.
const rankedUsers = sql`
  with xp as (${userXp})
  select
    u.id as user_id,
    u.address,
    xp.xp,
    row_number() over (
      order by xp.xp desc, xp.reached_at asc, u.id asc
    )::int as rank
  from xp
  join users u on u.id = xp.user_id
`;

type RankedRow = {
  user_id: number;
  address: string;
  xp: number;
  rank: number;
};

@Injectable()
export class LeaderboardService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async top() {
    const { rows } = await this.db.execute<RankedRow>(sql`
      select * from (${rankedUsers}) r
      order by r.rank, r.user_id
      limit ${LEADERBOARD_SIZE}
    `);
    return rows.map((r) => ({
      rank: r.rank,
      address: getAddress(r.address),
      xp: r.xp,
      level: levelForXp(r.xp),
    }));
  }

  // rank is null until the user has any XP. xpToNextRank is what it takes
  // to pass the user one place above (1 XP when they have the same XP but
  // got there first), null when already first.
  async rankOf(userId: number) {
    const { rows } = await this.db.execute<{
      rank: number;
      xp: number;
      above_xp: number | null;
    }>(sql`
      with r as (${rankedUsers})
      select me.rank, me.xp, above.xp as above_xp
      from r me
      left join r above on above.rank = me.rank - 1
      where me.user_id = ${userId}
    `);

    const me = rows[0];
    if (!me) return { rank: null, xp: 0, xpToNextRank: null };
    return {
      rank: me.rank,
      xp: me.xp,
      xpToNextRank: me.above_xp === null ? null : me.above_xp - me.xp + 1,
    };
  }
}
