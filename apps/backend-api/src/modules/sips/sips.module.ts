import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { SipsController } from './sips.controller';
import { SipsService } from './sips.service';

@Module({
  imports: [CoreModule, UsersModule, TransactionsModule, CommissionsModule],
  controllers: [SipsController],
  providers: [SipsService],
  exports: [SipsService],
})
export class SipsModule {}
