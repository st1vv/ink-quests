import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { campaignRewards, questCompletions, users } from '../database/schema';

export const ACTIVITY_LIMIT = 10;
export const ACTIVITY_PAGE_SIZE = 50;

type ActivityRow = {
  // 'bonus' is XP an admin gave (or took) by hand; its title is the reason.
  type: 'check-in' | 'quest' | 'referral' | 'campaign' | 'bonus';
  title: string | null;
  // The campaign of a partner quest task; null for the rest.
  partner: string | null;
  points: number;
  bonus_points: number;
  // Raw Postgres timestamp text (e.g. '2026-09-27 09:00:00+00').
  at: string;
  tx_hash: string | null;
  // The UTC day a check-in counts for (YYYY-MM-DD); null for the rest.
  day: string | null;
};

// Profile extras on top of GET /me/progress and GET /me/rank.
@Injectable()
export class ProfileService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async stats(userId: number) {
    const [user] = await this.db
      .select({ joinedAt: users.createdAt, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId));

    // Quests that paid XP (daily ones), plus finished campaigns: a campaign
    // counts once, not once per 0 XP task.
    const [{ quests }] = await this.db
      .select({ quests: count() })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, userId),
          gt(questCompletions.points, 0),
        ),
      );
    const [{ campaigns }] = await this.db
      .select({ campaigns: count() })
      .from(campaignRewards)
      .where(eq(campaignRewards.userId, userId));

    return {
      joinedAt: user.joinedAt,
      displayName: user.displayName,
      questsCompleted: quests + campaigns,
    };
  }

  // null clears the name. The unique index settles a race for the same name.
  async setDisplayName(userId: number, displayName: string | null) {
    try {
      await this.db
        .update(users)
        .set({ displayName })
        .where(eq(users.id, userId));
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code === '23505') {
        throw new ConflictException('This name is taken');
      }
      throw err;
    }
    return { displayName };
  }

  // Latest XP-earning actions, newest first.
  async activity(userId: number) {
    const { rows } = await this.db.execute<ActivityRow>(sql`
      select * from (${activityRows(userId, false)}) a
      order by at desc, type, title
      limit ${ACTIVITY_LIMIT}
    `);
    return rows.map(toActivity);
  }

  // One page of everything the user did, for the admin user page. Unlike
  // activity(), it also lists campaign tasks, which are worth 0 XP.
  async activityPage(userId: number, page: number) {
    const rows = activityRows(userId, true);
    const [counted, listed] = await Promise.all([
      this.db.execute<{ total: number }>(
        sql`select count(*)::int as total from (${rows}) a`,
      ),
      this.db.execute<ActivityRow>(sql`
        select * from (${rows}) a
        order by at desc, type, title
        limit ${ACTIVITY_PAGE_SIZE} offset ${(page - 1) * ACTIVITY_PAGE_SIZE}
      `),
    ]);

    return {
      total: counted.rows[0].total,
      page,
      pageSize: ACTIVITY_PAGE_SIZE,
      items: listed.rows.map((r) => ({
        ...toActivity(r),
        // Campaign title for a campaign task.
        partner: r.partner,
      })),
    };
  }
}

// Every XP-earning action of the user, one row each. withTasks adds the
// campaign tasks, which are worth 0 XP on their own: the campaign's reward
// shows up as its own row.
const activityRows = (userId: number, withTasks: boolean) => sql`
  select
    'check-in' as type,
    null::text as title,
    null::text as partner,
    points,
    bonus_points,
    created_at as at,
    tx_hash::text as tx_hash,
    day::text as day
  from check_ins
  where user_id = ${userId}
  union all
  select 'quest', q.title, p.title, c.points, 0, c.completed_at, c.tx_hash, null
  from quest_completions c
  join quests q on q.id = c.quest_id
  left join partners p on p.id = q.partner_id
  where c.user_id = ${userId} ${withTasks ? sql.empty() : sql`and c.points > 0`}
  union all
  select 'referral', u.address, null, r.points, 0, r.created_at, null, null
  from referral_rewards r
  join users u on u.id = r.referred_id
  where r.referrer_id = ${userId}
  union all
  select 'campaign', p.title, null, cr.points, 0, cr.created_at, null, null
  from campaign_rewards cr
  join partners p on p.id = cr.partner_id
  where cr.user_id = ${userId}
  union all
  select 'bonus', g.reason, null, g.points, 0, g.created_at, null, null
  from xp_grants g
  where g.user_id = ${userId}
`;

const toActivity = (r: ActivityRow) => ({
  type: r.type,
  title: r.title,
  points: r.points,
  bonusPoints: r.bonus_points,
  // ISO, which every browser parses.
  at: new Date(r.at).toISOString(),
  txHash: r.tx_hash,
  // A paid check-in can be credited after its day (see ProgressService).
  day: r.day,
});
