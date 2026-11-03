import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { ApiErrorFilter } from '../src/core/filters/api-error.filter';
import { dotenv } from '../src/startup/dotenv';

dotenv();
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'e2e-access-secret-at-least-32-characters';
process.env['JWT_REFRESH_SECRET'] =
  process.env['JWT_REFRESH_SECRET'] ?? 'e2e-refresh-secret-at-least-32-characters';

const hasDatabase = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!hasDatabase)('WealthOS API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiErrorFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects invalid credentials with the standard error envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@wealthos.dev', password: 'WrongPass1' })
      .expect(401);
    expect(response.body).toMatchObject({ ok: false, data: null });
    expect(response.body.error.errorCode).toBe('UNAUTHORIZED');
  });

  it('logs in a seeded advisor and reads the session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nirav@wealthos.dev', password: 'Password123!' })
      .expect(201);
    expect(login.body.user.email).toBe('nirav@wealthos.dev');
    const token = login.body.tokens.accessToken as string;
    const session = await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(session.body.role).toBe('ADVISOR');
  });

  it('serves advisor analytics to an authenticated advisor', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nirav@wealthos.dev', password: 'Password123!' })
      .expect(201);
    const token = login.body.tokens.accessToken as string;
    const analytics = await request(app.getHttpServer())
      .get('/api/v1/analytics/advisor')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(typeof analytics.body.aumTotalPaise).toBe('number');
    expect(Array.isArray(analytics.body.timeseries)).toBe(true);
  });
});
