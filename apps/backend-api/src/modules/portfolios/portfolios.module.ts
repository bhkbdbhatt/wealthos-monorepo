import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { UsersModule } from '../users/users.module';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';

@Module({
  imports: [CoreModule, UsersModule],
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}
