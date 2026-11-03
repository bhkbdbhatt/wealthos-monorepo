#!/usr/bin/env node
/**
 * WealthOS API bootstrap.
 * Global prefix /api/v1, ValidationPipe, error envelope, CORS.
 */
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NextFunction, type Request, type Response } from 'express';
import { json, urlencoded } from 'express';
import { dotenv } from './startup/dotenv';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './core/filters/api-error.filter';
import { readAppConfig } from './core/app-config';

async function bootstrap(): Promise<void> {
  dotenv();
  const config = readAppConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  app.use(json({ limit: config.requestBodyLimit }));
  app.use(urlencoded({ limit: config.requestBodyLimit, extended: true }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const requestTimeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          ok: false,
          data: null,
          error: { statusCode: 503, errorCode: 'REQUEST_TIMEOUT', message: 'Request timed out' },
        });
      }
      res.end();
    }, config.requestTimeoutMs);
    res.once('finish', () => clearTimeout(requestTimeout));
    res.once('close', () => clearTimeout(requestTimeout));
    next();
  });
  await app.listen(config.port);
  new Logger('Bootstrap').log(`WealthOS API listening on port ${config.port}`);
  let shutdownStarted = false;
  const gracefulShutdown = (): void => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    const forceShutdown = setTimeout(() => {
      process.exit(1);
    }, config.shutdownTimeoutMs);
    forceShutdown.unref();
    app.close()
      .then(() => clearTimeout(forceShutdown))
      .catch(() => {
        clearTimeout(forceShutdown);
        process.exit(1);
      });
  };
  process.once('SIGTERM', gracefulShutdown);
  process.once('SIGINT', gracefulShutdown);
}

void bootstrap();
