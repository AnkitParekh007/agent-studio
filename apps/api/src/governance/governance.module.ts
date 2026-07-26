import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';
import { PlaygroundModule } from '../playground/playground.module.js';
import { EvalsService } from './evals.service.js';
import { GovernanceController } from './governance.controller.js';
import { GovernanceService } from './governance.service.js';

@Module({
  imports: [
    AuthModule,
    AgentsModule,
    GatewayModule,
    forwardRef(() => PlaygroundModule),
  ],
  controllers: [GovernanceController],
  providers: [GovernanceService, EvalsService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
