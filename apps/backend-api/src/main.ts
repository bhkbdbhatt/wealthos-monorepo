#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * WealthOS API bootstrap.
 * Global prefix /api/v1, ValidationPipe, error envelope, CORS.
 */
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { dotenv } from './startup/dotenv';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './core/filters/api-error.filter';
import { readAppConfig } from './core/app-config';

async function bootstrap(): Promise<void> {
  dotenv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const config = readAppConfig();
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });
  await app.listen(config.port);
  console.log(`WealthOS API listening on http://localhost:${config.port}/api/v1`);
}

void bootstrap();
