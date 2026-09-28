import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { checkIns, questCompletions } from '../database/schema';
import { utcDay } from '../quests/period';
import { levelProgress } from './level';
import { currentStreak } from './streak';
import { completesWeek, utcWeekDays } from './week';

export const CHECK_IN_XP = 10;
// Extra XP for checking in every day from Monday to Sunday.
export const FULL_WEEK_BONUS_XP = 10;

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
        checkInXp: sql<number>`coalesce(sum(${checkIns.points} + ${checkIns.bonusPoints}), 0)::int`,
      })
      .from(checkIns)
      .where(eq(checkIns.userId, userId));

    const days = await this.recentCheckInDays(userId, now);
    const checkedIn = new Set(days);

    const totalXp = questXp + checkInXp;
    return {
      totalXp,
      ...levelProgress(totalXp),
      streak: currentStreak(days, now),
      checkedInToday: checkedIn.has(utcDay(now)),
      // Monday to Sunday of the current UTC week.
      week: utcWeekDays(now).map((d) => checkedIn.has(d)),
      checkInXp: CHECK_IN_XP,
      fullWeekBonusXp: FULL_WEEK_BONUS_XP,
    };
  }

  async checkIn(userId: number, now = new Date()) {
    const checkedIn = new Set(await this.recentCheckInDays(userId, now));
    const bonusPoints = completesWeek(checkedIn, now) ? FULL_WEEK_BONUS_XP : 0;

    // The unique (user, day) index makes a second check-in a no-op, even
    // when two requests race, so the bonus can't be paid twice either.
    const [row] = await this.db
      .insert(checkIns)
      .values({ userId, day: utcDay(now), points: CHECK_IN_XP, bonusPoints })
      .onConflictDoNothing()
      .returning({
        day: checkIns.day,
        points: checkIns.points,
        bonusPoints: checkIns.bonusPoints,
      });
    if (!row) throw new ConflictException('Already checked in today');
    return row;
  }

  // Distinct check-in days, newest first.
  private async recentCheckInDays(userId: number, now: Date) {
    const since = utcDay(
      new Date(now.getTime() - STREAK_LOOKBACK_DAYS * DAY_MS),
    );
    const rows = await this.db
      .select({ day: checkIns.day })
      .from(checkIns)
      .where(and(eq(checkIns.userId, userId), gte(checkIns.day, since)))
      .orderBy(desc(checkIns.day));
    return rows.map((r) => r.day);
  }
}
