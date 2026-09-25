import { Logger } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

const logger = new Logger('Database');

export const createDatabase = (url: string) => {
  const pool = new Pool({ connectionString: url });
  // An idle client dropped by the server (restart, network blip) emits
  // 'error' on the pool; unhandled, that crashes the whole process.
  pool.on('error', (err) => logger.error(`Idle client error: ${err.message}`));

  const db: Database = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
};
