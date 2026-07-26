import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoreModule } from './core/core.module.js';
import { GatewayModule } from './gateway/gateway.module.js';
import { HealthController } from './health.controller.js';
import { OrgsModule } from './orgs/orgs.module.js';
import { PlaygroundModule } from './playground/playground.module.js';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    OrgsModule,
    AgentsModule,
    ApprovalsModule,
    ApplicationsModule,
    GatewayModule,
    PlaygroundModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
