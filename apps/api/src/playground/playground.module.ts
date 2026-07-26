import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';
import { GovernanceModule } from '../governance/governance.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PlaygroundController } from './playground.controller.js';
import { PlaygroundService } from './playground.service.js';

@Module({
  imports: [
    AuthModule,
    AgentsModule,
    GatewayModule,
    forwardRef(() => GovernanceModule),
    IntegrationsModule,
  ],
  controllers: [PlaygroundController],
  providers: [PlaygroundService],
  exports: [PlaygroundService],
})
export class PlaygroundModule {}
