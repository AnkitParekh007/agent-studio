import type { AppEnv } from '@agent-studio/config';
import type { createDb } from '@agent-studio/database';
import type { AuthInstance } from '@agent-studio/auth';
import type { RuntimeProviderRegistry } from '@agent-studio/runtime-core';
import type { Queue } from 'bullmq';

export const ENV = Symbol('ENV');
export const DB = Symbol('DB');
export const AUTH = Symbol('AUTH');
export const RUNTIME_REGISTRY = Symbol('RUNTIME_REGISTRY');
export const PROVISION_QUEUE = Symbol('PROVISION_QUEUE');

export type Db = ReturnType<typeof createDb>;
export type Env = AppEnv;
export type Auth = AuthInstance;
export type Registry = RuntimeProviderRegistry;
export type ProvisionQueue = Queue;
