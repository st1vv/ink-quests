import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WeeklyController } from './weekly.controller';
import { WeeklyService } from './weekly.service';

// Weekly missions: bigger goals for a UTC week, counted from what users
// already do, with XP to claim once done.
@Module({
  imports: [AuthModule],
  controllers: [WeeklyController],
  providers: [WeeklyService],
})
export class WeeklyModule {}
