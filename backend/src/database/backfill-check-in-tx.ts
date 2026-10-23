// One-off: links paid check-ins credited before check_ins.tx_hash existed
// to their transactions, from the CheckIn contract's CheckedIn events.
// Only fills check-ins that have no hash yet, so it's safe to re-run.
//
//   npm run db:backfill-check-in-tx            (ts-node, e.g. locally)
//   node dist/database/backfill-check-in-tx.js (the production image)
//
// Needs DATABASE_URL and CHECKIN_CONTRACT; INK_RPC_URL is optional.
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Address } from 'viem';
import { createInkClient } from '../chain/ink-client';
import { loadEnvFile } from '../config/load-env-file';
import { checkInAbi } from '../progress/check-in-tx';
import { createDatabase } from './client';
import { checkIns, users } from './schema';

loadEnvFile();

// The block the CheckIn contract was deployed in (contracts/broadcast).
const DEPLOY_BLOCK = 59_070_848n;
// Ink's public RPC serves logs for at most 1000 blocks per request.
const CHUNK = 1000n;
const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const contract = process.env.CHECKIN_CONTRACT as Address | undefined;
  if (!contract) throw new Error('CHECKIN_CONTRACT is not set');

  const client = createInkClient(process.env.INK_RPC_URL);
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    const head = await client.getBlockNumber();
    let linked = 0;
    let found = 0;
    for (let from = DEPLOY_BLOCK; from <= head; from += CHUNK) {
      const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
      const events = await client.getContractEvents({
        address: contract,
        abi: checkInAbi,
        eventName: 'CheckedIn',
        fromBlock: from,
        toBlock: to,
      });
      for (const event of events) {
        found++;
        const day = new Date(Number(event.args.day!) * DAY_MS)
          .toISOString()
          .slice(0, 10);
        const updated = await db
          .update(checkIns)
          .set({ txHash: event.transactionHash })
          .where(
            and(
              eq(checkIns.day, day),
              isNull(checkIns.txHash),
              eq(
                checkIns.userId,
                sql`(select ${users.id} from ${users} where ${users.address} = ${event.args.user!.toLowerCase()})`,
              ),
            ),
          )
          .returning({ id: checkIns.id });
        linked += updated.length;
      }
    }
    console.log(
      `${found} paid check-ins on chain, ${linked} linked to their transactions.`,
    );
  } finally {
    await pool.end();
  }
}

void main();
