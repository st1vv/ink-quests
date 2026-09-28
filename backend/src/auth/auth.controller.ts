import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import type { Env } from '../config/env';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, sessionCookieOptions } from './session-cookie';

const verifyBody = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/) as z.ZodType<`0x${string}`>,
  // Invite code; a malformed one is dropped rather than failing the login.
  ref: z
    .string()
    .regex(/^[A-Za-z0-9]{4,16}$/)
    .optional()
    .catch(undefined),
});

@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieOptions = sessionCookieOptions(
      config.get('FRONTEND_ORIGIN', { infer: true }),
    );
  }

  @Get('nonce')
  async nonce() {
    return { nonce: await this.auth.createNonce() };
  }

  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = verifyBody.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(z.prettifyError(input.error));
    }

    const session = await this.auth.signIn(
      input.data.message,
      input.data.signature,
      input.data.ref,
    );
    if (!session) {
      throw new UnauthorizedException('Invalid or expired sign-in message');
    }

    res.cookie(SESSION_COOKIE, session.token, {
      ...this.cookieOptions,
      expires: session.expiresAt,
    });
    return { address: session.user.address };
  }

  // Always 200 so a signed-out visitor doesn't produce console errors;
  // routes that need a user use AuthGuard instead.
  @Get('session')
  async session(@Req() req: Request) {
    const token = this.tokenFrom(req);
    const user = token ? await this.auth.getSessionUser(token) : null;
    return { address: user?.address ?? null };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.tokenFrom(req);
    if (token) await this.auth.signOut(token);
    res.clearCookie(SESSION_COOKIE, this.cookieOptions);
  }

  private tokenFrom(req: Request) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    return typeof token === 'string' ? token : null;
  }
}
