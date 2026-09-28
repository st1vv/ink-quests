import { Inject, Injectable } from '@nestjs/common';
import { count, eq, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { checkIns, questCompletions, users } from '../database/schema';
import { longestStreak } from '../progress/streak';

export const ACTIVITY_LIMIT = 30;

type ActivityRow = {
  type: 'check-in' | 'quest';
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
      .select({ joinedAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId));

    const [{ questsCompleted }] = await this.db
      .select({ questsCompleted: count() })
      .from(questCompletions)
      .where(eq(questCompletions.userId, userId));

    const days = await this.db
      .select({ day: checkIns.day })
      .from(checkIns)
      .where(eq(checkIns.userId, userId));

    return {
      joinedAt: user.joinedAt,
      checkIns: days.length,
      questsCompleted,
      bestStreak: longestStreak(days.map((d) => d.day)),
    };
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
        where c.user_id = ${userId}
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
