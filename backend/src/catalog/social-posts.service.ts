import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { socialPosts } from '../database/schema';

// The X post of the day for the daily "like & repost" quest.
@Injectable()
export class SocialPostsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // The post for a UTC day (YYYY-MM-DD), or null.
  async forDay(day: string) {
    const [row] = await this.db
      .select({ postUrl: socialPosts.postUrl })
      .from(socialPosts)
      .where(eq(socialPosts.day, day));
    return row?.postUrl ?? null;
  }

  // Days from `from` through `to` that have a post, oldest first.
  list(from: string, to: string) {
    return this.db
      .select({ day: socialPosts.day, postUrl: socialPosts.postUrl })
      .from(socialPosts)
      .where(and(gte(socialPosts.day, from), lte(socialPosts.day, to)))
      .orderBy(asc(socialPosts.day));
  }

  // Sets the day's post; null clears it.
  async set(day: string, postUrl: string | null) {
    if (!postUrl) {
      await this.db.delete(socialPosts).where(eq(socialPosts.day, day));
      return;
    }
    await this.db
      .insert(socialPosts)
      .values({ day, postUrl })
      .onConflictDoUpdate({
        target: socialPosts.day,
        set: { postUrl, updatedAt: new Date() },
      });
  }
}
