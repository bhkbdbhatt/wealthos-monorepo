import { Controller, Get } from '@nestjs/common';
import { Public } from './core/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  status(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
