import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';

@Module({
  imports: [AuthModule, AgentsModule],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
