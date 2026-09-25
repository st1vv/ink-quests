import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { createDatabase } from './client';

// Inject with @Inject(DB) and type as Database.
export const DB = Symbol('DB');
const CONNECTION = Symbol('DB_CONNECTION');

type Connection = ReturnType<typeof createDatabase>;

@Injectable()
class ConnectionShutdown implements OnApplicationShutdown {
  constructor(@Inject(CONNECTION) private readonly connection: Connection) {}

  async onApplicationShutdown() {
    await this.connection.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createDatabase(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DB,
      inject: [CONNECTION],
      useFactory: ({ db }: Connection) => db,
    },
    ConnectionShutdown,
  ],
  exports: [DB],
})
export class DatabaseModule {}
