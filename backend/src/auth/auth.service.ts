import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, lt } from 'drizzle-orm';
import { createPublicClient, getAddress, http, type Hex } from 'viem';
import { ink } from 'viem/chains';
import { generateSiweNonce, parseSiweMessage } from 'viem/siwe';
import type { Env } from '../config/env';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { authNonces, sessions, users } from '../database/schema';

const NONCE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthUser = { id: number; address: string };

export type Session = {
  token: string;
  expiresAt: Date;
  user: AuthUser;
};

const createInkClient = (rpcUrl?: string) =>
  createPublicClient({ chain: ink, transport: http(rpcUrl) });

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  // The SIWE message must be issued for our frontend, not another site
  // that tricked the user into signing.
  private readonly domain: string;
  private readonly client: ReturnType<typeof createInkClient>;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.domain = new URL(config.get('FRONTEND_ORIGIN', { infer: true })).host;
    this.client = createInkClient(config.get('INK_RPC_URL', { infer: true }));
  }

  async createNonce() {
    // Opportunistic cleanup keeps the table small without a cron job.
    await this.db
      .delete(authNonces)
      .where(lt(authNonces.expiresAt, new Date()));

    const nonce = generateSiweNonce();
    await this.db
      .insert(authNonces)
      .values({ nonce, expiresAt: new Date(Date.now() + NONCE_TTL_MS) });
    return nonce;
  }

  // Returns null when the message or signature doesn't check out.
  async signIn(message: string, signature: Hex): Promise<Session | null> {
    const parsed = parseSiweMessage(message);
    if (!parsed.nonce || !parsed.address || parsed.chainId !== ink.id) {
      return null;
    }

    // Burn the nonce before checking the signature, so each one gets
    // exactly one attempt and a captured message can't be replayed.
    const [consumed] = await this.db
      .delete(authNonces)
      .where(
        and(
          eq(authNonces.nonce, parsed.nonce),
          gt(authNonces.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!consumed) return null;

    // Also covers smart-contract wallets (ERC-1271 / ERC-6492) via the RPC.
    const isValid = await this.client.verifySiweMessage({
      message,
      signature,
      domain: this.domain,
      nonce: parsed.nonce,
    });
    if (!isValid) return null;

    const now = new Date();
    const [user] = await this.db
      .insert(users)
      .values({ address: parsed.address.toLowerCase(), lastLoginAt: now })
      .onConflictDoUpdate({ target: users.address, set: { lastLoginAt: now } })
      .returning({ id: users.id, address: users.address });

    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, now)));

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.db
      .insert(sessions)
      .values({ id: hashToken(token), userId: user.id, expiresAt });

    return { token, expiresAt, user: toAuthUser(user) };
  }

  async getSessionUser(token: string): Promise<AuthUser | null> {
    const [row] = await this.db
      .select({ id: users.id, address: users.address })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.id, hashToken(token)),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ? toAuthUser(row) : null;
  }

  async signOut(token: string) {
    await this.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
}

// Addresses are stored lowercased; hand out the checksummed form.
const toAuthUser = (row: AuthUser): AuthUser => ({
  id: row.id,
  address: getAddress(row.address),
});
