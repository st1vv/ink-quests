import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { weeklyMissionClaims, weeklyMissions } from '../database/schema';
import { utcWeekDays } from '../progress/week';
import { pickMissions, type MissionSlug } from './missions';

const DAY_MS = 24 * 60 * 60 * 1000;

type ProgressRow = Record<
  'check_ins' | 'daily_quests' | 'active_days' | 'referrals' | 'social_quests',
  number
>;

// The UTC day of a timestamp column, to compare with the week's days.
const utcDate = (column: SQL) => sql`(${column} at time zone 'UTC')::date`;

@Injectable()
export class WeeklyService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // The week's missions with the user's progress; progress stays 0 and
  // nothing is claimed for a signed-out visitor (userId null).
  async missions(userId: number | null, now = new Date()) {
    const week = utcWeekDays(now)[0];
    const missions = await this.weekMissions(week);
    const [progress, claimed] = userId
      ? await Promise.all([
          this.progress(userId, week),
          this.claimedIds(
            userId,
            missions.map((m) => m.id),
          ),
        ])
      : [null, new Set<number>()];

    return {
      // The week's Monday, YYYY-MM-DD.
      week,
      // Next Monday 00:00 UTC, when the next week's missions start.
      resetsAt: new Date(Date.parse(week) + 7 * DAY_MS).toISOString(),
      missions: missions.map((m) => ({
        slug: m.slug,
        title: m.title,
        description: m.description,
        target: m.target,
        points: m.points,
        // Capped at the target: going past it changes nothing.
        progress: Math.min(progress?.[m.slug as MissionSlug] ?? 0, m.target),
        claimed: claimed.has(m.id),
      })),
    };
  }

  // The mission's XP, once its target is reached this week.
  async claim(userId: number, slug: string, now = new Date()) {
    const week = utcWeekDays(now)[0];
    const mission = (await this.weekMissions(week)).find(
      (m) => m.slug === slug,
    );
    if (!mission) throw new NotFoundException('No such mission this week');

    const progress = (await this.progress(userId, week))[
      mission.slug as MissionSlug
    ];
    if (progress < mission.target) {
      throw new UnprocessableEntityException(
        `This mission isn't done yet: ${progress}/${mission.target}`,
      );
    }

    // The unique (user, mission) index makes a repeat a no-op, even when
    // two requests race.
    const inserted = await this.db
      .insert(weeklyMissionClaims)
      .values({ userId, missionId: mission.id, points: mission.points })
      .onConflictDoNothing()
      .returning({ id: weeklyMissionClaims.id });
    if (inserted.length === 0) {
      throw new ConflictException('This mission is already claimed');
    }
    return { slug: mission.slug, title: mission.title, points: mission.points };
  }

  // Picked and stored the first time the week is asked for; the unique
  // (week, slug) index keeps one set when two requests race.
  private async weekMissions(week: string) {
    const stored = () =>
      this.db
        .select()
        .from(weeklyMissions)
        .where(eq(weeklyMissions.week, week))
        .orderBy(asc(weeklyMissions.sortOrder));

    const existing = await stored();
    if (existing.length > 0) return existing;

    await this.db
      .insert(weeklyMissions)
      .values(pickMissions(week).map((m) => ({ ...m, week })))
      .onConflictDoNothing();
    return stored();
  }

  private async claimedIds(userId: number, missionIds: number[]) {
    if (missionIds.length === 0) return new Set<number>();
    const rows = await this.db
      .select({ missionId: weeklyMissionClaims.missionId })
      .from(weeklyMissionClaims)
      .where(
        and(
          eq(weeklyMissionClaims.userId, userId),
          inArray(weeklyMissionClaims.missionId, missionIds),
        ),
      );
    return new Set(rows.map((r) => r.missionId));
  }

  // Each mission's count for the user in the week starting on `week`.
  // Daily quest completions count for their UTC day (`period`); other
  // actions for the UTC day they happened.
  private async progress(
    userId: number,
    week: string,
  ): Promise<Record<MissionSlug, number>> {
    const from = sql`${week}::date`;
    const inWeek = (day: SQL) =>
      sql`${day} >= ${from} and ${day} < ${from} + 7`;

    const { rows } = await this.db.execute<ProgressRow>(sql`
      select
        (select count(*)::int from check_ins
          where user_id = ${userId} and ${inWeek(sql`day`)}) as check_ins,
        (select count(*)::int from quest_completions c
          join quests q on q.id = c.quest_id
          where c.user_id = ${userId} and q.kind = 'daily'
            and ${inWeek(sql`c.period`)}) as daily_quests,
        (select count(*)::int from quest_completions c
          join quests q on q.id = c.quest_id
          where c.user_id = ${userId} and q.kind = 'daily'
            and 'Social' = any(q.tags)
            and ${inWeek(sql`c.period`)}) as social_quests,
        (select count(*)::int from (
          select day from check_ins where user_id = ${userId}
          union
          select ${utcDate(sql.raw('completed_at'))} from quest_completions
            where user_id = ${userId}
          union
          select ${utcDate(sql.raw('created_at'))} from campaign_rewards
            where user_id = ${userId}
        ) d where ${inWeek(sql`d.day`)}) as active_days,
        (select count(*)::int from referral_rewards
          where referrer_id = ${userId}
            and ${inWeek(utcDate(sql.raw('created_at')))}) as referrals
    `);

    const r = rows[0];
    return {
      'check-ins': r.check_ins,
      'daily-quests': r.daily_quests,
      'active-days': r.active_days,
      referrals: r.referrals,
      'social-quests': r.social_quests,
    };
  }
}
