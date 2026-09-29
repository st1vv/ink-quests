import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // Behind Railway's proxy the client IP is in X-Forwarded-For; without
  // this the rate limit would see one IP (the proxy) for everyone.
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));

  app.enableCors({
    origin: config.get('FRONTEND_ORIGIN', { infer: true }),
    // Lets the browser send the SIWE session cookie.
    credentials: true,
  });
  app.use(cookieParser());
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
