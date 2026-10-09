import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(includeInactive = false) {
    return this.prisma.user.findMany({
      where: includeInactive ? {} : { active: true },
      select: USER_SELECT,
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    });
  }

  async create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        displayName: dto.displayName.trim(),
        role: dto.role,
        passwordHash: await AuthService.hashPassword(dto.password),
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const target = await this.getOrThrow(id);

    // 防止管理员把自己降级或停用后无人能管理系统
    if (target.id === actor.id && (dto.role === Role.MEMBER || dto.active === false)) {
      throw new ForbiddenException('不能修改自己的角色或停用自己的账号');
    }
    if (target.role === Role.ADMIN && (dto.role === Role.MEMBER || dto.active === false)) {
      await this.assertNotLastAdmin(target.id);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        displayName: dto.displayName?.trim(),
        role: dto.role,
        active: dto.active,
      },
      select: USER_SELECT,
    });
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    await this.getOrThrow(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await AuthService.hashPassword(dto.newPassword) },
    });
    return { success: true };
  }

  async remove(id: string, actor: AuthUser) {
    const target = await this.getOrThrow(id);
    if (target.id === actor.id) throw new ForbiddenException('不能删除自己的账号');
    if (target.role === Role.ADMIN) await this.assertNotLastAdmin(target.id);

    // 任务上的负责人是可选外键，删除用户时置空，避免连带删除测试数据
    return this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
      await tx.user.delete({ where: { id } });
      return { success: true };
    });
  }

  private async getOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  private async assertNotLastAdmin(excludeId: string) {
    const remaining = await this.prisma.user.count({
      where: { role: Role.ADMIN, active: true, id: { not: excludeId } },
    });
    if (remaining === 0) throw new ForbiddenException('系统至少需要保留一个启用的管理员');
  }
}
