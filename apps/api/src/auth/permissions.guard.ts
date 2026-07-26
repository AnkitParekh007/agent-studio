import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { assertPermission } from '@agent-studio/authorization';
import type { Permission } from '@agent-studio/domain';
import { PERMISSIONS_KEY } from './permissions.decorator.js';
import type { RequestContext } from './auth.types.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handlerPerms =
      (Reflect.getMetadata(PERMISSIONS_KEY, context.getHandler()) as Permission[] | undefined) ??
      [];
    const classPerms =
      (Reflect.getMetadata(PERMISSIONS_KEY, context.getClass()) as Permission[] | undefined) ?? [];
    const permissions = handlerPerms.length > 0 ? handlerPerms : classPerms;
    if (permissions.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ authContext?: RequestContext }>();
    const authContext = req.authContext;
    if (!authContext) throw new ForbiddenException('Missing auth context');

    try {
      for (const permission of permissions) {
        assertPermission(authContext.roleKey, permission);
      }
      return true;
    } catch (err) {
      throw new ForbiddenException(err instanceof Error ? err.message : 'Forbidden');
    }
  }
}
