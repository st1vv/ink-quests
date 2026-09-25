import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { checkIns, questCompletions } from '../database/schema';
import { utcDay } from '../quests/period';
import { levelProgress } from './level';
import { currentStreak } from './streak';

export const CHECK_IN_XP = 20;

// Only this far back is read to compute the streak, so it tops out here.
const STREAK_LOOKBACK_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ProgressService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async progress(userId: number, now = new Date()) {
    const [{ questXp }] = await this.db
      .select({
        questXp: sql<number>`coalesce(sum(${questCompletions.points}), 0)::int`,
      })
      .from(questCompletions)
      .where(eq(questCompletions.userId, userId));

    const [{ checkInXp }] = await this.db
      .select({
        checkInXp: sql<number>`coalesce(sum(${checkIns.points}), 0)::int`,
      })
      .from(checkIns)
      .where(eq(checkIns.userId, userId));

    const since = utcDay(
      new Date(now.getTime() - STREAK_LOOKBACK_DAYS * DAY_MS),
    );
    const days = await this.db
      .select({ day: checkIns.day })
      .from(checkIns)
      .where(and(eq(checkIns.userId, userId), gte(checkIns.day, since)))
      .orderBy(desc(checkIns.day));

    const totalXp = questXp + checkInXp;
    return {
      totalXp,
      ...levelProgress(totalXp),
      streak: currentStreak(
        days.map((d) => d.day),
        now,
      ),
      checkedInToday: days[0]?.day === utcDay(now),
    };
  }

  async checkIn(userId: number, now = new Date()) {
    const day = utcDay(now);
    // The unique (user, day) index makes a second check-in a no-op, even
    // when two requests race.
    const [row] = await this.db
      .insert(checkIns)
      .values({ userId, day, points: CHECK_IN_XP })
      .onConflictDoNothing()
      .returning({ day: checkIns.day, points: checkIns.points });
    if (!row) throw new ConflictException('Already checked in today');
    return row;
  }
}
