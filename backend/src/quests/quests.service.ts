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
import { SocialPostsService } from '../catalog/social-posts.service';
import { XService } from '../x/x.service';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { questCompletions, quests } from '../database/schema';
import { ReferralsService } from '../referrals/referrals.service';
import { ONE_TIME_PERIOD, questPeriod, startOfUtcDay, utcDay } from './period';
import { VerificationService, type Verification } from './verification.service';
import {
  isOffchain,
  isPostOfTheDay,
  minUsdOf,
  shareDaysOf,
  VERIFIERS,
  withMinUsd,
} from './verifiers';
import {
  parsePostUrl,
  sharePostProblem,
  type PostEmbed,
} from '../x/share-post';

// The account a progress post must tag; the share text always does.
const SHARE_MENTION = 'inkquests';

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
    // Nado's own stats run up to ~20 minutes behind its trades.
    case 'futures':
      return `No Nado futures trades of at least $${minUsd} found yet. Nado's trading stats can take up to 20 minutes to update, so if you just traded, try again a bit later`;
    case 'order':
      return `No settled CoW Swap swap of at least $${minUsd} found yet today. Orders take a few seconds to settle, so if you just swapped, try again in a minute`;
    case 'balance':
      return 'Not enough of this token in your wallet yet. Hold the amount the task asks for and try again';
    case 'token':
      return `No purchase of at least $${minUsd} of this token found yet today. If you just bought it, try again in a minute`;
    case 'referrer':
      return "InkQuests isn't your referrer there yet. Register with our link on the partner's Referrals page, then try again in a minute";
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
    private readonly socialPosts: SocialPostsService,
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

  // `proofUrl` is the user's X post, for "share your progress".
  async claim(
    user: AuthUser,
    questId: number,
    { proofUrl }: { proofUrl?: string } = {},
    now = new Date(),
  ) {
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
    // Only the day's rotating set can be claimed, not the whole catalog. The
    // "like & repost" quest is on whenever the day has a post, "share your
    // progress" on its own days.
    const postOfTheDay = isPostOfTheDay(quest.verifier);
    const shareDays = shareDaysOf(quest.verifier);
    if (
      quest.kind === 'daily' &&
      !(postOfTheDay
        ? await this.socialPosts.forDay(utcDay(now))
        : shareDays
          ? shareDays.includes(utcDay(now))
          : await this.schedule.isScheduled(quest.id, now))
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
    // Follows, likes and reposts on X are taken on trust (X's API charges
    // per read). Once X linking is set up (X_CLIENT_* env), the user also
    // needs a linked X account, one per wallet; until then anyone can
    // verify them.
    const follow = spec.every(
      (s) => s.type === 'x-follow' || s.type === 'x-like-repost',
    );
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
    // Opening a page has nothing to check.
    const visit = spec.every((s) => s.type === 'visit');
    // The progress post is checked here, before anything onchain.
    const share = spec.every((s) => s.type === 'x-share-progress');
    const proof = share
      ? await this.checkSharePost(user.id, proofUrl, windowStart)
      : null;

    let result: Verification;
    try {
      result =
        follow || dailyDone || visit || share
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

    // A post already used by someone else (possible only without X linking,
    // where the author isn't checked) is turned away here; the unique index
    // below still settles a race.
    if (proof && (await this.proofUsed(quest.id, proof))) {
      throw new UnprocessableEntityException(
        'This post was already used to claim the quest',
      );
    }

    // The unique indexes settle a race between two parallel claims.
    const [completion] = await this.db
      .insert(questCompletions)
      .values({
        userId: user.id,
        questId: quest.id,
        period,
        points: quest.points,
        txHash: result.txHash,
        proofUrl: proof,
      })
      .onConflictDoNothing()
      .returning({ points: questCompletions.points });
    if (!completion) throw new ConflictException('Already claimed');

    // A verified onchain quest (plus a linked X account, checked there) is
    // what makes an invited user count; a follow or a visit doesn't.
    if (!isOffchain(spec)) await this.referrals.rewardReferrer(user.id);

    return {
      questId: quest.id,
      points: completion.points,
      txHash: result.txHash,
    };
  }

  // The canonical link of the user's progress post, once X confirms it: it
  // exists and is public, was posted since `since` (the quest's day), tags
  // @inkquests and, with X linking set up, is by the user's linked account.
  private async checkSharePost(
    userId: number,
    proofUrl: string | undefined,
    since: Date,
  ) {
    const post = proofUrl ? parsePostUrl(proofUrl) : null;
    if (!post) {
      throw new BadRequestException(
        'Paste the link to your post on X, like https://x.com/you/status/123',
      );
    }

    const username = this.x.available
      ? (await this.x.account(userId)).username
      : null;
    if (this.x.available && !username) {
      throw new UnprocessableEntityException(
        'Connect your X account on your profile first',
      );
    }

    let embed: PostEmbed | null;
    try {
      embed = await this.x.postEmbed(post.url);
    } catch (err) {
      this.logger.warn(`X post check failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        "Couldn't reach X right now, try again in a moment",
      );
    }
    if (!embed) {
      throw new UnprocessableEntityException(
        "Couldn't find this post on X. Make sure it's public and the link is right",
      );
    }

    switch (
      sharePostProblem(post.id, embed, {
        username,
        mention: SHARE_MENTION,
        since,
      })
    ) {
      case 'author':
        throw new UnprocessableEntityException(
          `This post isn't from your linked X account @${username}`,
        );
      case 'date':
        throw new UnprocessableEntityException(
          'This post is older than today. Share your progress again today',
        );
      case 'mention':
        throw new UnprocessableEntityException(
          `The post has to tag @${SHARE_MENTION}. Post it with the Share button, which adds the tag`,
        );
    }
    return post.url;
  }

  private async proofUsed(questId: number, proofUrl: string) {
    const [row] = await this.db
      .select({ id: questCompletions.id })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.questId, questId),
          eq(questCompletions.proofUrl, proofUrl),
        ),
      )
      .limit(1);
    return Boolean(row);
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
