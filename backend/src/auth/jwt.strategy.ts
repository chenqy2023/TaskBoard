import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('缺少环境变量 JWT_SECRET');
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: secret });
  }

  /**
   * 每次请求都回库读一次用户，保证「被停用 / 被删除 / 改了角色」能立刻生效，
   * 而不是等 token 过期。用户量很小，这点开销可以接受。
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.authService.findAuthUser(payload.sub);
    if (!user) throw new UnauthorizedException('账号已失效，请重新登录');
    return user;
  }
}
