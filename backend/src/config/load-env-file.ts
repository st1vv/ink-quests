import { existsSync } from 'node:fs';

// For scripts run outside Nest (drizzle-kit, seed). The file is optional:
// in Docker the variables come from docker-compose instead, and values
// already set in the environment are never overridden.
export const loadEnvFile = () => {
  if (existsSync('.env')) process.loadEnvFile('.env');
};
