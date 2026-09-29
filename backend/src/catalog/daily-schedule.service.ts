import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { dailyQuestSchedule, quests } from '../database/schema';
import { utcDay } from '../quests/period';
import { pickDailyQuests } from './rotation';

const DAY_MS = 24 * 60 * 60 * 1000;

// Which daily quests are on for a UTC day. The set is picked the first time
// the day is asked for and stored, so it stays fixed for the whole day.
@Injectable()
export class DailyScheduleService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Quest ids for the day, in display order.
  async questIdsFor(now = new Date()) {
    const day = utcDay(now);
    const scheduled = await this.scheduled(day);
    if (scheduled.length) return scheduled;

    await this.create(day, utcDay(new Date(now.getTime() - DAY_MS)));
    return this.scheduled(day);
  }

  async isScheduled(questId: number, now = new Date()) {
    return (await this.questIdsFor(now)).includes(questId);
  }

  private async scheduled(day: string) {
    const rows = await this.db
      .select({ questId: dailyQuestSchedule.questId })
      .from(dailyQuestSchedule)
      .where(eq(dailyQuestSchedule.day, day))
      .orderBy(asc(dailyQuestSchedule.position));
    return rows.map((r) => r.questId);
  }

  private async create(day: string, yesterday: string) {
    // Only quests that can be claimed are worth a slot.
    const candidates = await this.db
      .select({ id: quests.id, slug: quests.slug, group: quests.groupKey })
      .from(quests)
      .where(
        and(
          eq(quests.kind, 'daily'),
          eq(quests.isActive, true),
          isNotNull(quests.verifier),
        ),
      );
    const groupOf = new Map(candidates.map((c) => [c.id, c.group ?? c.slug]));

    const yesterdays = await this.scheduled(yesterday);
    const ids = pickDailyQuests(
      candidates.map((c) => ({ id: c.id, group: groupOf.get(c.id)! })),
      day,
      new Set(yesterdays.map((id) => groupOf.get(id) ?? `quest-${id}`)),
    );
    if (!ids.length) return;

    // Two first requests racing both pick the same set (it only depends on
    // the day and the catalog); the primary key keeps a single copy.
    await this.db
      .insert(dailyQuestSchedule)
      .values(ids.map((questId, position) => ({ day, position, questId })))
      .onConflictDoNothing();
  }
}
