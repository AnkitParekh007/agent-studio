import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';
import { PublicApiController } from './public-api.controller.js';

@Module({
  imports: [AuthModule, GatewayModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
