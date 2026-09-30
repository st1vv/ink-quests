import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import {
  campaignRewards,
  partners,
  questCompletions,
  quests,
} from '../database/schema';
import { ONE_TIME_PERIOD } from '../quests/period';

// A campaign pays its XP once, for all of its tasks together: each task is
// only verified on its own (a 0 XP quest completion).
@Injectable()
export class CampaignsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Slugs of the campaigns whose reward the user has claimed.
  async claimed(userId: number) {
    const rows = await this.db
      .select({ slug: partners.slug })
      .from(campaignRewards)
      .innerJoin(partners, eq(partners.id, campaignRewards.partnerId))
      .where(eq(campaignRewards.userId, userId));
    return rows.map((r) => r.slug);
  }

  async claim(userId: number, slug: string) {
    const [campaign] = await this.db
      .select({ id: partners.id, rewardXp: partners.rewardXp })
      .from(partners)
      .where(and(eq(partners.slug, slug), eq(partners.isActive, true)))
      .limit(1);
    if (!campaign) throw new NotFoundException('Quest not found');

    const tasks = await this.db
      .select({ id: quests.id })
      .from(quests)
      .where(and(eq(quests.partnerId, campaign.id), eq(quests.isActive, true)));
    if (!tasks.length || campaign.rewardXp <= 0) {
      throw new UnprocessableEntityException('This quest has no reward');
    }

    const verified = await this.db
      .select({ questId: questCompletions.questId })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, userId),
          eq(questCompletions.period, ONE_TIME_PERIOD),
          inArray(
            questCompletions.questId,
            tasks.map((t) => t.id),
          ),
        ),
      );
    const left = tasks.length - new Set(verified.map((v) => v.questId)).size;
    if (left > 0) {
      throw new UnprocessableEntityException(
        `Verify all tasks first (${left} left)`,
      );
    }

    // The unique (user, campaign) index settles a double click.
    const [reward] = await this.db
      .insert(campaignRewards)
      .values({ userId, partnerId: campaign.id, points: campaign.rewardXp })
      .onConflictDoNothing()
      .returning({ points: campaignRewards.points });
    if (!reward) throw new ConflictException('Already claimed');
    return { slug, points: reward.points };
  }
}
