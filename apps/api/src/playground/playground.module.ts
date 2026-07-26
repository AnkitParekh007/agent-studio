import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';
import { PlaygroundController } from './playground.controller.js';
import { PlaygroundService } from './playground.service.js';

@Module({
  imports: [AuthModule, AgentsModule, GatewayModule],
  controllers: [PlaygroundController],
  providers: [PlaygroundService],
})
export class PlaygroundModule {}
