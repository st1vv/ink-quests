import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { asc, desc, gt, lte, sql, and } from 'drizzle-orm';
import { getAddress } from 'viem';
import type { Env } from '../config/env';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { challenges } from '../database/schema';
import { xLinkingConfigured } from '../x/x-config';
import { HIDDEN_ADDRESSES, LEADERBOARD_SIZE } from './leaderboard.service';

// Referral rewards a user can count in one challenge; more still pay XP,
// they just don't add to the challenge score.
export const CHALLENGE_REFERRAL_LIMIT = 5;

type Challenge = typeof challenges.$inferSelect;

type StandingRow = {
  user_id: number;
  address: string;
  display_name: string | null;
  score: number;
  rank: number;
};

// Everything that scores in a challenge, as (user_id, points, at): daily
// quest completions (the "like & repost" quest included), check-ins with
// their weekly bonus, and each referrer's first CHALLENGE_REFERRAL_LIMIT
// referral rewards, all made between startsAt (inclusive) and endsAt
// (exclusive). Partner quests don't count.
const activity = (c: Challenge) => sql`
  select c.user_id, c.points, c.completed_at as at
  from quest_completions c
  join quests q on q.id = c.quest_id
  where q.kind = 'daily'
    and c.completed_at >= ${c.startsAt} and c.completed_at < ${c.endsAt}
  union all
  select user_id, points + bonus_points, created_at
  from check_ins
  where created_at >= ${c.startsAt} and created_at < ${c.endsAt}
  union all
  select referrer_id, points, created_at
  from (
    select
      referrer_id, points, created_at,
      row_number() over (
        partition by referrer_id order by created_at, id
      ) as n
    from referral_rewards
    where created_at >= ${c.startsAt} and created_at < ${c.endsAt}
  ) r
  where n <= ${CHALLENGE_REFERRAL_LIMIT}
`;

@Injectable()
export class ChallengeService {
  // Only wallets with a linked X account take part, once X linking is set
  // up; until then everyone does.
  private readonly xRequired: boolean;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.xRequired = xLinkingConfigured(config);
  }

  // The challenge to show: the one running now, else the last one that
  // ended, else the next one to start. Null when there are none.
  async current(now = new Date()) {
    const [live] = await this.db
      .select()
      .from(challenges)
      .where(and(lte(challenges.startsAt, now), gt(challenges.endsAt, now)))
      .orderBy(desc(challenges.startsAt))
      .limit(1);
    if (live) return { ...live, status: 'live' as const };

    const [ended] = await this.db
      .select()
      .from(challenges)
      .where(lte(challenges.endsAt, now))
      .orderBy(desc(challenges.endsAt))
      .limit(1);
    if (ended) return { ...ended, status: 'ended' as const };

    const [upcoming] = await this.db
      .select()
      .from(challenges)
      .where(gt(challenges.startsAt, now))
      .orderBy(asc(challenges.startsAt))
      .limit(1);
    return upcoming ? { ...upcoming, status: 'upcoming' as const } : null;
  }

  // Everyone who scored, ranked: more points first, then whoever reached
  // their score first (the earlier last scoring action), then whoever
  // signed up first. Our own wallets are left out, like on the leaderboard.
  private standings(c: Challenge) {
    const hidden = sql.join(
      HIDDEN_ADDRESSES.map((a) => sql`${a}`),
      sql`, `,
    );
    const xFilter = this.xRequired
      ? sql`and u.x_user_id is not null`
      : sql.empty();
    return sql`
      with scores as (
        select
          user_id,
          sum(points)::int as score,
          max(at) filter (where points > 0) as reached_at
        from (${activity(c)}) a
        group by user_id
        having sum(points) > 0
      )
      select
        u.id as user_id, u.address, u.display_name, s.score,
        row_number() over (
          order by s.score desc, s.reached_at asc, u.id asc
        )::int as rank
      from scores s
      join users u on u.id = s.user_id
      where u.address not in (${hidden}) ${xFilter}
    `;
  }

  // GET /challenge: the challenge and its top players.
  async overview(now = new Date()) {
    const challenge = await this.current(now);
    if (!challenge) return { challenge: null, top: [] };

    const { rows } = await this.db.execute<StandingRow>(sql`
      select * from (${this.standings(challenge)}) r
      order by r.rank
      limit ${LEADERBOARD_SIZE}
    `);
    return {
      challenge: this.present(challenge),
      top: rows.map((r) => ({
        rank: r.rank,
        address: getAddress(r.address),
        name: r.display_name,
        score: r.score,
      })),
    };
  }

  // GET /me/challenge: the user's place and what holds them back. rank is
  // null until they score, or while they can't take part (no linked X).
  async mine(userId: number, now = new Date()) {
    const challenge = await this.current(now);
    if (!challenge) return null;

    const [{ rows: ranked }, { rows: user }, { rows: referrals }] =
      await Promise.all([
        this.db.execute<{ rank: number; score: number }>(sql`
          select rank, score from (${this.standings(challenge)}) r
          where r.user_id = ${userId}
        `),
        this.db.execute<{
          x_user_id: string | null;
          display_name: string | null;
        }>(sql`select x_user_id, display_name from users where id = ${userId}`),
        this.db.execute<{ counted: number }>(sql`
          select least(count(*), ${CHALLENGE_REFERRAL_LIMIT})::int as counted
          from referral_rewards
          where referrer_id = ${userId}
            and created_at >= ${challenge.startsAt}
            and created_at < ${challenge.endsAt}
        `),
      ]);

    const xLinked = Boolean(user[0]?.x_user_id);
    return {
      rank: ranked[0]?.rank ?? null,
      name: user[0]?.display_name ?? null,
      score: ranked[0]?.score ?? 0,
      // Taking part needs a linked X account (once X linking is set up).
      eligible: xLinked || !this.xRequired,
      xLinked,
      referralsCounted: referrals[0]?.counted ?? 0,
    };
  }

  private present(c: Challenge & { status: 'live' | 'ended' | 'upcoming' }) {
    return {
      slug: c.slug,
      title: c.title,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      status: c.status,
      places: c.places,
      prize: c.prize,
      postUrl: c.postUrl,
      prizeItems: c.prizeItems,
      referralLimit: CHALLENGE_REFERRAL_LIMIT,
      xRequired: this.xRequired,
    };
  }
}
