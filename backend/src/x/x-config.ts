import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

// Whether an X app is set up (X_CLIENT_* env); without one, nothing that
// needs a linked X account asks for it.
export const xLinkingConfigured = (config: ConfigService<Env, true>) =>
  Boolean(
    config.get('X_CLIENT_ID', { infer: true }) &&
    config.get('X_CLIENT_SECRET', { infer: true }) &&
    config.get('X_REDIRECT_URI', { infer: true }),
  );
