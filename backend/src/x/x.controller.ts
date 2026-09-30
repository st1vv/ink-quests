import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import type { Env } from '../config/env';
import { XLinkFailure, XService } from './x.service';

@Controller()
export class XController {
  private readonly frontendOrigin: string;

  constructor(
    private readonly x: XService,
    config: ConfigService<Env, true>,
  ) {
    this.frontendOrigin = config.get('FRONTEND_ORIGIN', { infer: true });
  }

  // { available, username }: whether linking is set up, and the linked
  // handle (null if none).
  @Get('me/x')
  @UseGuards(AuthGuard)
  account(@CurrentUser() user: AuthUser) {
    return this.x.account(user.id);
  }

  // Opened by the browser (a top-level navigation, so the session cookie
  // is sent); redirects to X's consent page.
  @Get('auth/x/start')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async start(@CurrentUser() user: AuthUser, @Res() res: Response) {
    try {
      res.redirect(await this.x.authorizationUrl(user.id));
    } catch (err) {
      this.backToProfile(res, err);
    }
  }

  // X redirects here after the user approves or cancels.
  @Get('auth/x/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    try {
      if (error || !code || !state) throw new XLinkFailure('denied');
      await this.x.complete(code, state);
      this.backToProfile(res);
    } catch (err) {
      this.backToProfile(res, err);
    }
  }

  // The profile page shows a toast for ?x=connected or ?x=<reason>.
  private backToProfile(res: Response, err?: unknown) {
    const reason =
      err === undefined
        ? 'connected'
        : err instanceof XLinkFailure
          ? err.reason
          : 'failed';
    res.redirect(`${this.frontendOrigin}/profile?x=${reason}`);
  }
}
