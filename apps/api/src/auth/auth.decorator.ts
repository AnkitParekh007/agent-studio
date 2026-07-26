import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestContext } from './auth.types.js';

export const AuthCtx = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestContext => {
  const req = ctx.switchToHttp().getRequest<{ authContext?: RequestContext }>();
  if (!req.authContext) {
    throw new Error('Auth context missing');
  }
  return req.authContext;
});
