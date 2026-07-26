import { loadEnv } from '@agent-studio/config';
import {
  agentDeployments,
  agentVersions,
  auditEvents,
  createDb,
  newId,
} from '@agent-studio/database';
import { composeInstructions, type AgentVersionConfig } from '@agent-studio/domain';
import { RuntimeProviderRegistry } from '@agent-studio/runtime-core';
import { tryCreateClaudeAdapter } from '@agent-studio/runtime-claude';
import { LocalRuntimeAdapter } from '@agent-studio/runtime-local';
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';

async function main() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  const registry = new RuntimeProviderRegistry();
  registry.register(
    new LocalRuntimeAdapter({
      allowLocal: Boolean(env.RUNTIME_ALLOW_LOCAL),
      nodeEnv: env.NODE_ENV,
    }),
  );
  const claude = tryCreateClaudeAdapter({
    apiKey: env.ANTHROPIC_API_KEY || undefined,
    baseUrl: env.ANTHROPIC_BASE_URL,
  });
  if (claude) registry.register(claude);

  const worker = new Worker(
    'agent-provision',
    async (job) => {
      const { organizationId, agentId, versionId, actorUserId } = job.data as {
        organizationId: string;
        agentId: string;
        versionId: string;
        actorUserId: string;
      };

      const [version] = await db
        .select()
        .from(agentVersions)
        .where(eq(agentVersions.id, versionId))
        .limit(1);
      if (!version) throw new Error(`Version ${versionId} not found`);

      const config = JSON.parse(version.configJson) as AgentVersionConfig;
      const adapter = registry.get(config.runtimeProvider);
      const deploymentId = newId('dep');
      const now = new Date();

      await db.insert(agentDeployments).values({
        id: deploymentId,
        organizationId,
        agentId,
        versionId,
        runtimeProvider: config.runtimeProvider,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      try {
        const provisioned = await adapter.provisionDeployment({
          organizationId,
          agentVersionId: versionId,
          configuration: {
            name: `agent-${agentId}`,
            model: config.model,
            instructions: composeInstructions(config),
          },
        });

        await db
          .update(agentDeployments)
          .set({
            status: 'ready',
            providerAgentId: provisioned.providerAgentId,
            providerEnvironmentId: provisioned.providerEnvironmentId,
            providerDeploymentId: provisioned.id,
            updatedAt: new Date(),
          })
          .where(eq(agentDeployments.id, deploymentId));

        await db.insert(auditEvents).values({
          id: newId('audit'),
          organizationId,
          actorUserId,
          action: 'deployment.provisioned',
          resourceType: 'agent_deployment',
          resourceId: deploymentId,
          metadata: JSON.stringify({
            runtimeProvider: config.runtimeProvider,
            providerAgentId: provisioned.providerAgentId,
          }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'provision failed';
        await db
          .update(agentDeployments)
          .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
          .where(eq(agentDeployments.id, deploymentId));
        throw err;
      }
    },
    { connection: { url: env.REDIS_URL } },
  );

  worker.on('completed', (job) => {
    console.log(`Provision job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`Provision job ${job?.id} failed`, err);
  });

  console.log('Agent Studio worker listening for provision jobs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
