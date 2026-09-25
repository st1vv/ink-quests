import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { ProgressModule } from './progress/progress.module';
import { QuestsModule } from './quests/quests.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    AuthModule,
    CatalogModule,
    QuestsModule,
    ProgressModule,
    LeaderboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
