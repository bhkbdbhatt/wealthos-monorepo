import { Module } from '@nestjs/common';
import { type Provider } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AppConfig, appConfigInjectionToken } from '../../../core/app-config';
import { CoreModule } from '../../../core/core.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenFactory } from './token.factory';

export const tokenFactoryProvider: Provider = {
  provide: TokenFactory,
  useFactory: (jwt: JwtService, config: AppConfig): TokenFactory => new TokenFactory(jwt, config),
  inject: [JwtService, appConfigInjectionToken],
};

@Module({
  imports: [CoreModule],
  controllers: [AuthController],
  providers: [AuthService, tokenFactoryProvider],
})
export class AuthModule {}
