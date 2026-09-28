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
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { questCompletions, quests } from '../database/schema';
import { ReferralsService } from '../referrals/referrals.service';
import { ONE_TIME_PERIOD, questPeriod, startOfUtcDay, utcDay } from './period';
import { VerificationService, type Verification } from './verification.service';
import { VERIFIERS } from './verifiers';

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly verification: VerificationService,
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
        createdAt: quests.createdAt,
      })
      .from(quests)
      .where(and(eq(quests.id, questId), eq(quests.isActive, true)))
      .limit(1);
    if (!quest) throw new NotFoundException('Quest not found');

    const spec = quest.verifier ? VERIFIERS[quest.verifier] : undefined;
    if (!spec) {
      throw new BadRequestException("This quest can't be claimed yet");
    }

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
    let result: Verification;
    try {
      result = await this.verification.verify(
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
        result.missing === 'nft'
          ? 'No NFT from this collection found in your wallet'
          : // The explorer indexes a few seconds behind the chain, so a
            // fresh transaction may not be visible on the first try.
            'No matching transaction found yet (supplies need at least $1). If you just made it, try again in a minute',
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

    // A verified onchain quest is what makes an invited user count.
    await this.referrals.rewardReferrer(user.id);

    return {
      questId: quest.id,
      points: completion.points,
      txHash: result.txHash,
    };
  }
}
