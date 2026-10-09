import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { Address } from 'viem';
import type { AuthUser } from '../auth/auth.service';
import { DailyScheduleService } from '../catalog/daily-schedule.service';
import { XService } from '../x/x.service';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { questCompletions, quests } from '../database/schema';
import { ReferralsService } from '../referrals/referrals.service';
import { ONE_TIME_PERIOD, questPeriod, startOfUtcDay, utcDay } from './period';
import { VerificationService, type Verification } from './verification.service';
import { isOffchain, minUsdOf, VERIFIERS, withMinUsd } from './verifiers';

// Explorers and Relay index a few seconds behind the chain, so a fresh
// transaction may not be visible on the first try.
const missingMessage = (
  missing: Extract<Verification, { done: false }>['missing'],
  minUsd: number | null,
) => {
  switch (missing) {
    case 'transaction':
      return minUsd === null
        ? 'No matching transaction found yet. If you just made it, try again in a minute'
        : `No matching transaction worth at least $${minUsd} found yet. If you just made it, try again in a minute`;
    case 'nft':
      return 'No NFT from this collection found in your wallet';
    case 'bridge':
      return `No Relay bridge of at least $${minUsd} to Ink found yet today (from Ethereum, Base, Arbitrum or Robinhood Chain). If you just bridged, try again in a minute`;
  }
};

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly verification: VerificationService,
    private readonly schedule: DailyScheduleService,
    private readonly x: XService,
    private readonly referrals: ReferralsService,
  ) {}

  // Quests the user has completed for the current period: today's daily
  // quests plus every one-time quest.
  async completedQuestIds(userId: number, now = new Date()) {
    const rows = await this.db
      .select({ questId: questCompletions.questId })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, userId),
          inArray(questCompletions.period, [utcDay(now), ONE_TIME_PERIOD]),
        ),
      );
    return rows.map((r) => r.questId);
  }

  async claim(user: AuthUser, questId: number, now = new Date()) {
    const [quest] = await this.db
      .select({
        id: quests.id,
        kind: quests.kind,
        points: quests.points,
        verifier: quests.verifier,
        minUsd: quests.minUsd,
        createdAt: quests.createdAt,
      })
      .from(quests)
      .where(and(eq(quests.id, questId), eq(quests.isActive, true)))
      .limit(1);
    if (!quest) throw new NotFoundException('Quest not found');

    const verifier = quest.verifier ? VERIFIERS[quest.verifier] : undefined;
    if (!verifier) {
      throw new BadRequestException("This quest can't be claimed yet");
    }
    // Only the day's rotating set can be claimed, not the whole catalog.
    if (
      quest.kind === 'daily' &&
      !(await this.schedule.isScheduled(quest.id, now))
    ) {
      throw new BadRequestException("This isn't one of today's daily quests");
    }
    // The $1/$5/$10 variants of a quest share a verifier; the quest says how
    // much it takes.
    const spec = withMinUsd(verifier, quest.minUsd);

    const period = questPeriod(quest.kind, now);
    const alreadyClaimed = await this.db
      .select({ id: questCompletions.id })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, user.id),
          eq(questCompletions.questId, quest.id),
          eq(questCompletions.period, period),
        ),
      )
      .limit(1);
    if (alreadyClaimed.length) throw new ConflictException('Already claimed');

    const windowStart =
      quest.kind === 'daily' ? startOfUtcDay(now) : quest.createdAt;
    // Follows on X are taken on trust (X's API charges per read). Once X
    // linking is set up (X_CLIENT_* env), the user also needs a linked X
    // account, one per wallet; until then anyone can verify a follow.
    const follow = spec.every((s) => s.type === 'x-follow');
    if (follow && this.x.available && !(await this.x.isLinked(user.id))) {
      throw new UnprocessableEntityException(
        'Connect your X account on your profile first',
      );
    }
    const dailyDone = spec.every((s) => s.type === 'daily-quest-done');
    if (dailyDone && !(await this.hasDoneADailyQuest(user.id))) {
      throw new UnprocessableEntityException(
        'Complete any daily quest first, then come back to claim',
      );
    }

    let result: Verification;
    try {
      result =
        follow || dailyDone
          ? { done: true, txHash: null }
          : await this.verification.verify(
              spec,
              user.address as Address,
              windowStart,
              now,
            );
    } catch (err) {
      this.logger.warn(`Quest check failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        "Couldn't check the chain right now, try again in a moment",
      );
    }

    if (!result.done) {
      throw new UnprocessableEntityException(
        missingMessage(result.missing, minUsdOf(spec)),
      );
    }

    // The unique index settles a race between two parallel claims.
    const [completion] = await this.db
      .insert(questCompletions)
      .values({
        userId: user.id,
        questId: quest.id,
        period,
        points: quest.points,
        txHash: result.txHash,
      })
      .onConflictDoNothing()
      .returning({ points: questCompletions.points });
    if (!completion) throw new ConflictException('Already claimed');

    // A verified onchain quest is what makes an invited user count; a follow
    // or a check in our own records doesn't.
    if (!isOffchain(spec)) await this.referrals.rewardReferrer(user.id);

    return {
      questId: quest.id,
      points: completion.points,
      txHash: result.txHash,
    };
  }

  private async hasDoneADailyQuest(userId: number) {
    const [row] = await this.db
      .select({ id: questCompletions.id })
      .from(questCompletions)
      .innerJoin(quests, eq(quests.id, questCompletions.questId))
      .where(and(eq(questCompletions.userId, userId), eq(quests.kind, 'daily')))
      .limit(1);
    return Boolean(row);
  }
}
