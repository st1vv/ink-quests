import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { partners, quests } from '../database/schema';
import { taskTypeOf } from '../quests/verifiers';
import { DailyScheduleService } from './daily-schedule.service';

// Public shape of a quest. The verifier key stays server-side; the client
// only needs to know whether the quest can be claimed yet.
const questFields = {
  id: quests.id,
  slug: quests.slug,
  title: quests.title,
  description: quests.description,
  actionUrl: quests.actionUrl,
  points: quests.points,
  claimable: isNotNull(quests.verifier),
};

const partnerFields = {
  slug: partners.slug,
  title: partners.title,
  description: partners.description,
  imageUrl: partners.imageUrl,
  websiteUrl: partners.websiteUrl,
  // Paid once all tasks are verified.
  rewardXp: partners.rewardXp,
};

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly schedule: DailyScheduleService,
  ) {}

  // Today's daily quests (a rotating set, see DailyScheduleService), in the
  // day's order.
  async dailyQuests(now = new Date()) {
    const ids = await this.schedule.questIdsFor(now);
    if (!ids.length) return [];

    const rows = await this.db
      .select(questFields)
      .from(quests)
      .where(and(inArray(quests.id, ids), eq(quests.isActive, true)));
    return ids.flatMap((id) => rows.filter((q) => q.id === id));
  }

  // Campaigns for the Quests page: active partners with at least one active
  // task, with the task count.
  partners() {
    return this.db
      .select({
        ...partnerFields,
        tasks: sql<number>`count(${quests.id})::int`,
      })
      .from(partners)
      .innerJoin(
        quests,
        and(eq(quests.partnerId, partners.id), eq(quests.isActive, true)),
      )
      .where(eq(partners.isActive, true))
      .groupBy(partners.id)
      .orderBy(asc(partners.id));
  }

  // Null when the partner doesn't exist or is inactive.
  async partner(slug: string) {
    const [partner] = await this.db
      .select(partnerFields)
      .from(partners)
      .where(and(eq(partners.slug, slug), eq(partners.isActive, true)))
      .limit(1);
    if (!partner) return null;

    const tasks = await this.db
      .select({ ...questFields, verifier: quests.verifier })
      .from(quests)
      .innerJoin(partners, eq(partners.id, quests.partnerId))
      .where(and(eq(partners.slug, slug), eq(quests.isActive, true)))
      .orderBy(asc(quests.sortOrder), asc(quests.id));

    // The verifier key stays server-side; its kind is enough for the UI.
    return {
      ...partner,
      quests: tasks.map(({ verifier, ...task }) => ({
        ...task,
        type: taskTypeOf(verifier),
      })),
    };
  }
}
