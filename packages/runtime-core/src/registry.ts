import type { AgentRuntimeAdapter, RuntimeProviderName } from './types.js';
import { RuntimeConfigurationError } from './types.js';

export class RuntimeProviderRegistry {
  private readonly adapters = new Map<RuntimeProviderName, AgentRuntimeAdapter>();

  register(adapter: AgentRuntimeAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: RuntimeProviderName): AgentRuntimeAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new RuntimeConfigurationError(`Runtime provider not registered: ${name}`);
    }
    return adapter;
  }

  list(): RuntimeProviderName[] {
    return [...this.adapters.keys()];
  }
}
