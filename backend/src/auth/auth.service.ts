import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** 校验账号密码，返回可签发的用户快照；失败统一抛 401 不区分原因。 */
  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) throw new UnauthorizedException('账号或密码错误');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('账号或密码错误');

    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    return {
      accessToken: await this.signToken(user),
      user: toAuthUser(user),
    };
  }

  signToken(user: { id: string; username: string; displayName: string; role: AuthUser['role'] }) {
    return this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  }

  static async hashPassword(plain: string) {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('登录状态已失效，请重新登录');

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('原密码不正确');

    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await AuthService.hashPassword(newPassword) },
    });
    return { success: true };
  }

  async findAuthUser(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user && user.active ? toAuthUser(user) : null;
  }
}

export function toAuthUser(user: {
  id: string;
  username: string;
  displayName: string;
  role: AuthUser['role'];
}): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}
