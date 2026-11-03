import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { UsersModule } from '../users/users.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [CoreModule, UsersModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
