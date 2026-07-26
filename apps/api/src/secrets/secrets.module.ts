import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SecretsController } from './secrets.controller.js';
import { SecretsService } from './secrets.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SecretsController],
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
