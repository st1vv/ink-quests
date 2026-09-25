import { defineConfig } from 'drizzle-kit';
import { loadEnvFile } from './src/config/load-env-file';

loadEnvFile();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: 'snake_case',
});
