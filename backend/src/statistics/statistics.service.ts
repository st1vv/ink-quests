import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { getAddress } from 'viem';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { partners, questCompletions, quests, users } from '../database/schema';
import { userXp } from '../leaderboard/leaderboard.service';

export const TRANSACTIONS_PAGE_SIZE = 50;

type StatsRow = {
  users: number;
  users_with_xp: number;
  daily_quests: number;
  partner_quests: number;
  check_ins: number;
  transactions: number;
  tx_users: number;
};

@Injectable()
export class StatisticsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async stats() {
    const { rows } = await this.db.execute<StatsRow>(sql`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from (${userXp}) x) as users_with_xp,
        (count(*) filter (where q.kind = 'daily'))::int as daily_quests,
        (select count(*)::int from campaign_rewards) as partner_quests,
        (select count(*)::int from check_ins) as check_ins,
        (count(*) filter (where c.tx_hash is not null))::int as transactions,
        (count(distinct c.user_id) filter (where c.tx_hash is not null))::int
          as tx_users
      from quest_completions c
      join quests q on q.id = c.quest_id
    `);

    const s = rows[0];
    return {
      users: s.users,
      usersWithXp: s.users_with_xp,
      // A partner quest counts once its whole campaign is done; its single
      // tasks don't count.
      questsCompleted: s.daily_quests + s.partner_quests,
      dailyQuestsCompleted: s.daily_quests,
      partnerQuestsCompleted: s.partner_quests,
      checkIns: s.check_ins,
      transactions: s.transactions,
      transactionUsers: s.tx_users,
    };
  }

  // Quest completions proven by an onchain transaction, newest first.
  // `address` narrows the list to one wallet.
  async transactions(page: number, address?: string) {
    const where = and(
      isNotNull(questCompletions.txHash),
      address ? eq(users.address, address.toLowerCase()) : undefined,
    );

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(questCompletions)
      .innerJoin(users, eq(users.id, questCompletions.userId))
      .where(where);

    const rows = await this.db
      .select({
        id: questCompletions.id,
        address: users.address,
        quest: quests.title,
        kind: quests.kind,
        partner: partners.title,
        points: questCompletions.points,
        txHash: questCompletions.txHash,
        completedAt: questCompletions.completedAt,
      })
      .from(questCompletions)
      .innerJoin(users, eq(users.id, questCompletions.userId))
      .innerJoin(quests, eq(quests.id, questCompletions.questId))
      .leftJoin(partners, eq(partners.id, quests.partnerId))
      .where(where)
      .orderBy(desc(questCompletions.completedAt), desc(questCompletions.id))
      .limit(TRANSACTIONS_PAGE_SIZE)
      .offset((page - 1) * TRANSACTIONS_PAGE_SIZE);

    return {
      total,
      page,
      pageSize: TRANSACTIONS_PAGE_SIZE,
      items: rows.map((r) => ({ ...r, address: getAddress(r.address) })),
    };
  }
}
