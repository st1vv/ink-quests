import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  // Feature modules import AuthModule to use AuthGuard on their routes.
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
