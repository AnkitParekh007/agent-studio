import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IntegrationsController } from './integrations.controller.js';
import { LocalToolWiringService } from './local-tool-wiring.service.js';
import { RuntimeContextService } from './runtime-context.service.js';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [RuntimeContextService, LocalToolWiringService],
  exports: [RuntimeContextService],
})
export class IntegrationsModule {}
