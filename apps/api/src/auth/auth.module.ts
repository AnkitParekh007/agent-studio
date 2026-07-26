import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, PermissionsGuard],
  exports: [AuthGuard, PermissionsGuard],
})
export class AuthModule {}

