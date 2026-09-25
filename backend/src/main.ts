import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.enableCors({
    origin: config.get('FRONTEND_ORIGIN', { infer: true }),
    // Needed later for the SIWE session cookie.
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
