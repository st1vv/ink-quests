import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Address } from 'viem';
import type { AuthUser } from '../auth/auth.service';
import { createInkClient, type InkClient } from '../chain/ink-client';
import type { Env } from '../config/env';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import {
  campaignRewards,
  checkIns,
  questCompletions,
  referralRewards,
} from '../database/schema';
import { utcDay } from '../quests/period';
import { checkInAbi, isCreditableDay } from './check-in-tx';
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
  private readonly logger = new Logger(ProgressService.name);
  private readonly client: InkClient;
  // The paid CheckIn contract; null keeps check-ins free.
  private readonly contract: Address | null;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.client = createInkClient(config.get('INK_RPC_URL', { infer: true }));
    const contract = config.get('CHECKIN_CONTRACT', { infer: true });
    this.contract = contract ? (contract as Address) : null;
  }

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

    const [{ referralXp }] = await this.db
      .select({
        referralXp: sql<number>`coalesce(sum(${referralRewards.points}), 0)::int`,
      })
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, userId));

    const days = await this.recentCheckInDays(userId, now);
    const checkedIn = new Set(days);

    const [{ campaignXp }] = await this.db
      .select({
        campaignXp: sql<number>`coalesce(sum(${campaignRewards.points}), 0)::int`,
      })
      .from(campaignRewards)
      .where(eq(campaignRewards.userId, userId));

    const totalXp = questXp + checkInXp + referralXp + campaignXp;
    return {
      totalXp,
      ...levelProgress(totalXp),
      streak: currentStreak(days, now),
      checkedInToday: checkedIn.has(utcDay(now)),
      // Monday to Sunday of the current UTC week.
      week: utcWeekDays(now).map((d) => checkedIn.has(d)),
      checkInXp: CHECK_IN_XP,
      fullWeekBonusXp: FULL_WEEK_BONUS_XP,
      // Where to pay for a check-in; null while check-ins are free.
      checkInContract: this.contract,
    };
  }

  // With the CheckIn contract set up, the check-in is the wallet's latest
  // paid one and counts for the day it was paid for; otherwise it's free and
  // counts for today.
  async checkIn(user: AuthUser, now = new Date()) {
    const at = this.contract ? await this.paidDay(user, now) : now;

    const checkedIn = new Set(await this.recentCheckInDays(user.id, at));
    const bonusPoints = completesWeek(checkedIn, at) ? FULL_WEEK_BONUS_XP : 0;

    // The unique (user, day) index makes a second check-in a no-op, even
    // when two requests race, so the bonus can't be paid twice either. It
    // also stops one payment from counting twice: it's for one day.
    const [row] = await this.db
      .insert(checkIns)
      .values({
        userId: user.id,
        day: utcDay(at),
        points: CHECK_IN_XP,
        bonusPoints,
      })
      .onConflictDoNothing()
      .returning({
        day: checkIns.day,
        points: checkIns.points,
        bonusPoints: checkIns.bonusPoints,
      });
    if (!row) throw new ConflictException('Already checked in today');
    return row;
  }

  // Midnight UTC of the day the wallet's latest paid check-in is for, read
  // from the contract. Asking the contract rather than a transaction means
  // a check-in that was paid but never reached us (a closed tab, a dropped
  // request) is still credited on the next try.
  private async paidDay(user: AuthUser, now: Date) {
    let day: number;
    try {
      day = Number(
        await this.client.readContract({
          address: this.contract!,
          abi: checkInAbi,
          functionName: 'lastCheckInDay',
          args: [user.address as Address],
        }),
      );
    } catch (err) {
      this.logger.warn(`Check-in read failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        "Couldn't check the chain right now, try again in a moment",
      );
    }

    if (!isCreditableDay(day, now)) {
      // Also right after paying: our RPC can be a block behind the wallet's.
      throw new UnprocessableEntityException(
        "Your paid check-in isn't confirmed yet. If you just paid, try again in a moment",
      );
    }
    return new Date(day * DAY_MS);
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
