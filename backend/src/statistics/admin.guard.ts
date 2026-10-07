import {
  Injectable,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';

// A signed-in wallet from ADMIN_ADDRESSES. Anyone else gets a 404, so the
// statistics routes look like they don't exist.
@Injectable()
export class AdminGuard extends AuthGuard {
  private readonly admins: Set<string>;

  constructor(auth: AuthService, config: ConfigService<Env, true>) {
    super(auth);
    this.admins = new Set(config.get('ADMIN_ADDRESSES', { infer: true }));
  }

  async canActivate(context: ExecutionContext) {
    // Signed out is a 404 too, not the usual 401.
    const signedIn = await super.canActivate(context).catch(() => false);
    if (!signedIn) throw new NotFoundException();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user || !this.admins.has(req.user.address.toLowerCase())) {
      throw new NotFoundException();
    }
    return true;
  }
}
