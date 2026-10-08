import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { campaignRewards, questCompletions, users } from '../database/schema';

export const ACTIVITY_LIMIT = 10;

type ActivityRow = {
  type: 'check-in' | 'quest' | 'referral' | 'campaign';
  title: string | null;
  points: number;
  bonus_points: number;
  // Raw Postgres timestamp text (e.g. '2026-09-27 09:00:00+00').
  at: string;
  tx_hash: string | null;
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
      select * from (
        select
          'check-in' as type,
          null::text as title,
          points,
          bonus_points,
          created_at as at,
          null::text as tx_hash
        from check_ins
        where user_id = ${userId}
        union all
        select 'quest', q.title, c.points, 0, c.completed_at, c.tx_hash
        from quest_completions c
        join quests q on q.id = c.quest_id
        -- Campaign tasks are worth 0 XP on their own; the campaign's reward
        -- shows up as its own row.
        where c.user_id = ${userId} and c.points > 0
        union all
        select 'referral', u.address, r.points, 0, r.created_at, null
        from referral_rewards r
        join users u on u.id = r.referred_id
        where r.referrer_id = ${userId}
        union all
        select 'campaign', p.title, cr.points, 0, cr.created_at, null
        from campaign_rewards cr
        join partners p on p.id = cr.partner_id
        where cr.user_id = ${userId}
      ) a
      order by at desc
      limit ${ACTIVITY_LIMIT}
    `);

    return rows.map((r) => ({
      type: r.type,
      title: r.title,
      points: r.points,
      bonusPoints: r.bonus_points,
      // ISO, which every browser parses.
      at: new Date(r.at).toISOString(),
      txHash: r.tx_hash,
    }));
  }
}
