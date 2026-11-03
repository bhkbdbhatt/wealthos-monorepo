/**
 * Root application module — wires infra providers + feature modules.
 * Business logic lives exclusively in module services (AGENTS.md).
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import {
  appConfigFactory,
  appConfigInjectionToken,
  appJwtModuleOptionsFactory,
} from './core/app-providers';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { BasketsModule } from './modules/baskets/baskets.module';
import { CasModule } from './modules/cas/cas.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { GoalsModule } from './modules/goals/goals.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { KycModule } from './modules/kyc/kyc.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { SegmentsModule } from './modules/segments/segments.module';
import { SipsModule } from './modules/sips/sips.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    JwtModule.registerAsync(appJwtModuleOptionsFactory),
    AuthModule,
    UsersModule,
    AssetsModule,
    PortfoliosModule,
    TransactionsModule,
    SipsModule,
    KycModule,
    CommissionsModule,
    CasModule,
    SegmentsModule,
    BasketsModule,
    GoalsModule,
    PartnersModule,
    AnalyticsModule,
    JobsModule,
  ],
  providers: [
    { provide: appConfigInjectionToken, useFactory: appConfigFactory },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
