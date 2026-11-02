import { Module } from '@nestjs/common';
import { CoreModule } from '../../../core/core.module';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { UsersModule } from '../users/users.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [CoreModule, UsersModule, PortfoliosModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
