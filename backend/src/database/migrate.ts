// Applies pending migrations from ./drizzle. Used by the production image,
// which has no drizzle-kit (a dev dependency); locally `npm run db:migrate`
// does the same with drizzle-kit.
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client';
import { loadEnvFile } from '../config/load-env-file';

loadEnvFile();

async function main() {
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

void main();
