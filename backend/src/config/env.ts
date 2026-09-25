import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  FRONTEND_ORIGIN: z.url(),
  // Used to verify smart-contract wallet signatures; viem's public Ink RPC
  // is used when unset.
  INK_RPC_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Used by ConfigModule: fail fast on startup instead of on first request.
export const validateEnv = (config: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
};
