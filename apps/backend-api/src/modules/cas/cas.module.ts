import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { UsersModule } from '../users/users.module';
import { CasController } from './cas.controller';
import { CasService } from './cas.service';

@Module({
  imports: [CoreModule, UsersModule],
  controllers: [CasController],
  providers: [CasService],
  exports: [CasService],
})
export class CasModule {}
