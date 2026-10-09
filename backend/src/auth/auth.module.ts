import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('缺少环境变量 JWT_SECRET');
        // '7d'、'12h' 这类写法运行期合法，但 @nestjs/jwt 的 StringValue 类型不接受任意字符串
        const expiresIn: string | number = config.get<string>('JWT_EXPIRES_IN') ?? '7d';
        return {
          secret,
          signOptions: { expiresIn: expiresIn as never },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
