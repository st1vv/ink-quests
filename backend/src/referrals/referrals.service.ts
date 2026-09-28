import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { referralRewards, users } from '../database/schema';

export const REFERRAL_XP = 50;

// No 0/O or 1/I, so a code read off a screen can't be mistyped. 32 symbols
// divide 256 evenly, so every byte maps to one without bias.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 5;

const generateCode = () =>
  [...randomBytes(CODE_LENGTH)]
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join('');

const isUniqueViolation = (err: unknown) =>
  (err as { cause?: { code?: string } }).cause?.code === '23505';

@Injectable()
export class ReferralsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // The user's invite code, created on first use.
  async codeFor(userId: number) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const [existing] = await this.db
        .select({ code: users.referralCode })
        .from(users)
        .where(eq(users.id, userId));
      if (existing?.code) return existing.code;

      try {
        // Only fills an empty code, so two parallel requests can't give
        // the user two different codes.
        const [row] = await this.db
          .update(users)
          .set({ referralCode: generateCode() })
          .where(and(eq(users.id, userId), isNull(users.referralCode)))
          .returning({ code: users.referralCode });
        if (row?.code) return row.code;
      } catch (err) {
        // Someone else already has this code: try another one.
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new Error(`Could not create a referral code for user ${userId}`);
  }

  async summary(userId: number) {
    const [{ invited }] = await this.db
      .select({ invited: count() })
      .from(users)
      .where(eq(users.referredById, userId));

    const [{ rewarded, xpEarned }] = await this.db
      .select({
        rewarded: count(),
        xpEarned: sql<number>`coalesce(sum(${referralRewards.points}), 0)::int`,
      })
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, userId));

    return {
      code: await this.codeFor(userId),
      // Signed up with the link.
      invited,
      // Also completed an onchain quest, which paid the reward.
      rewarded,
      xpEarned,
      rewardXp: REFERRAL_XP,
    };
  }

  // Called after every successful quest claim. Pays the referrer once per
  // invited user; the unique referred_id makes repeats a no-op.
  async rewardReferrer(referredUserId: number) {
    const [user] = await this.db
      .select({ referrerId: users.referredById })
      .from(users)
      .where(eq(users.id, referredUserId));
    if (!user?.referrerId) return;

    await this.db
      .insert(referralRewards)
      .values({
        referrerId: user.referrerId,
        referredId: referredUserId,
        points: REFERRAL_XP,
      })
      .onConflictDoNothing();
  }
}
