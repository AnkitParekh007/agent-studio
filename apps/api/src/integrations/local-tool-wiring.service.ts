import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LocalRuntimeAdapter } from '@agent-studio/runtime-local';
import { RUNTIME_REGISTRY, type Registry } from '../core/tokens.js';
import { RuntimeContextService } from './runtime-context.service.js';

@Injectable()
export class LocalToolWiringService implements OnModuleInit {
  constructor(
    @Inject(RUNTIME_REGISTRY) private readonly registry: Registry,
    @Inject(RuntimeContextService) private readonly runtimeContext: RuntimeContextService,
  ) {}

  onModuleInit() {
    try {
      const adapter = this.registry.get('local');
      if (!(adapter instanceof LocalRuntimeAdapter)) return;
      adapter.setToolCallHandler(async (toolName, input, context) => {
        if (!context.organizationId) {
          return { error: 'organizationId required for MCP tool calls' };
        }
        const result = await this.runtimeContext.callMcpTool(
          context.organizationId,
          toolName,
          undefined,
          input,
        );
        return { ok: true, ...result };
      });
    } catch {
      // Local adapter may be disabled.
    }
  }
}
