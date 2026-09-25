import {
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type AuthUser } from './auth.service';
import { SESSION_COOKIE } from './session-cookie';

type AuthedRequest = Request & { user?: AuthUser };

// Protect a route with @UseGuards(AuthGuard), then read the user with @CurrentUser().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user =
      typeof token === 'string' ? await this.auth.getSessionUser(token) : null;
    if (!user) throw new UnauthorizedException();

    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new Error('@CurrentUser() used without AuthGuard');
    return req.user;
  },
);
