import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Env } from '../config/env';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { users, xOauthStates } from '../database/schema';

const STATE_TTL_MS = 10 * 60 * 1000;
// Enough to read the user's own id and handle; no tokens are kept.
const SCOPES = 'users.read tweet.read';

// Why linking failed, for the redirect back to the frontend.
export type XLinkError =
  | 'unavailable' // no X app configured
  | 'denied' // the user cancelled on X
  | 'expired' // state unknown or too old
  | 'taken' // this X account is linked to another wallet
  | 'already-linked' // this wallet has a different X account
  | 'failed'; // X answered with an error

export class XLinkFailure extends Error {
  constructor(readonly reason: XLinkError) {
    super(reason);
  }
}

const base64url = (buf: Buffer) => buf.toString('base64url');

const isUniqueViolation = (err: unknown) =>
  (err as { cause?: { code?: string } }).cause?.code === '23505';

// Links a wallet to its owner's X account with OAuth 2.0 + PKCE. Only the
// X user id and handle are stored; the access token is used once and
// dropped.
@Injectable()
export class XService {
  private readonly logger = new Logger(XService.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;
  private readonly authorizeUrl: string;
  private readonly apiUrl: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.clientId = config.get('X_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('X_CLIENT_SECRET', { infer: true });
    this.redirectUri = config.get('X_REDIRECT_URI', { infer: true });
    this.authorizeUrl = config.get('X_AUTHORIZE_URL', { infer: true });
    this.apiUrl = config.get('X_API_URL', { infer: true });
  }

  get available() {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  async account(userId: number) {
    const [row] = await this.db
      .select({ username: users.xUsername })
      .from(users)
      .where(eq(users.id, userId));
    return { available: this.available, username: row?.username ?? null };
  }

  async isLinked(userId: number) {
    return (await this.account(userId)).username !== null;
  }

  // The X page to send the user to.
  async authorizationUrl(userId: number) {
    if (!this.available) throw new XLinkFailure('unavailable');

    await this.db
      .delete(xOauthStates)
      .where(lt(xOauthStates.expiresAt, new Date()));

    const state = base64url(randomBytes(24));
    const codeVerifier = base64url(randomBytes(32));
    await this.db.insert(xOauthStates).values({
      state,
      userId,
      codeVerifier,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      scope: SCOPES,
      state,
      code_challenge: base64url(
        createHash('sha256').update(codeVerifier).digest(),
      ),
      code_challenge_method: 'S256',
    });
    return `${this.authorizeUrl}?${params}`;
  }

  // Finishes the login X redirected back with; returns the linked handle.
  async complete(code: string, state: string) {
    if (!this.available) throw new XLinkFailure('unavailable');

    // Single use: a replayed callback finds nothing.
    const [pending] = await this.db
      .delete(xOauthStates)
      .where(
        and(
          eq(xOauthStates.state, state),
          gt(xOauthStates.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!pending) throw new XLinkFailure('expired');

    const accessToken = await this.exchangeCode(code, pending.codeVerifier);
    const xUser = await this.me(accessToken);
    await this.link(pending.userId, xUser);
    return xUser.username;
  }

  private async exchangeCode(code: string, codeVerifier: string) {
    const res = await fetch(`${this.apiUrl}/2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri!,
        code_verifier: codeVerifier,
        client_id: this.clientId!,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as {
      access_token?: string;
    } | null;
    if (!res.ok || !body?.access_token) {
      this.logger.warn(`X token exchange failed: ${res.status}`);
      throw new XLinkFailure('failed');
    }
    return body.access_token;
  }

  private async me(accessToken: string) {
    const res = await fetch(`${this.apiUrl}/2/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as {
      data?: { id?: string; username?: string };
    } | null;
    const id = body?.data?.id;
    const username = body?.data?.username;
    if (!res.ok || !id || !username) {
      this.logger.warn(`X users/me failed: ${res.status}`);
      throw new XLinkFailure('failed');
    }
    return { id, username };
  }

  private async link(userId: number, x: { id: string; username: string }) {
    const [user] = await this.db
      .select({ xUserId: users.xUserId })
      .from(users)
      .where(eq(users.id, userId));
    // Switching X accounts would free the old one for another wallet and
    // let the same person claim social quests twice.
    if (user?.xUserId && user.xUserId !== x.id) {
      throw new XLinkFailure('already-linked');
    }

    try {
      await this.db
        .update(users)
        .set({
          xUserId: x.id,
          // Refreshed on a re-link, in case the handle changed on X.
          xUsername: x.username,
          xLinkedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } catch (err) {
      if (isUniqueViolation(err)) throw new XLinkFailure('taken');
      throw err;
    }
  }
}
