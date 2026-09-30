import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { XController } from './x.controller';
import { XService } from './x.service';

// Linking an X (Twitter) account to a wallet, for social quests.
@Module({
  imports: [AuthModule],
  controllers: [XController],
  providers: [XService],
  exports: [XService],
})
export class XModule {}
