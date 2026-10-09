import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** 限定可访问该接口的角色，需配合 RolesGuard 使用。 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
