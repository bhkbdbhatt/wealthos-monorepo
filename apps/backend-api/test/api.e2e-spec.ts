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
const advisorEmail = 'nirav@wealthos.dev';
const clientEmail = 'asha.rao@client.dev';
const password = 'Password123!';

describe.skipIf(!hasDatabase)('WealthOS API (e2e)', () => {
  let app: INestApplication;

  async function login(email: string, credentials = password): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: credentials })
      .expect(201);
    return response.body.tokens.accessToken as string;
  }

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

  it('validates login request payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(response.body.ok).toBe(false);
  });

  it('reads the authenticated advisor session and refreshes it', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: advisorEmail, password })
      .expect(201);
    const accessToken = loginResponse.body.tokens.accessToken as string;
    const refreshToken = loginResponse.body.tokens.refreshToken as string;

    const session = await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(session.body.role).toBe('ADVISOR');

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(201);
    expect(refreshed.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('serves advisor analytics to an authenticated advisor', async () => {
    const token = await login(advisorEmail);
    const analytics = await request(app.getHttpServer())
      .get('/api/v1/analytics/advisor')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(typeof analytics.body.aumTotalPaise).toBe('number');
    expect(Array.isArray(analytics.body.timeseries)).toBe(true);
    expect(Array.isArray(analytics.body.byAssetClass)).toBe(true);
  });

  it('rejects protected advisor analytics for a client', async () => {
    const token = await login(clientEmail);
    await request(app.getHttpServer())
      .get('/api/v1/analytics/advisor')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('requires authentication for protected portfolio data', async () => {
    await request(app.getHttpServer()).get('/api/v1/portfolios').expect(401);
  });

  it('returns an investor portfolio with consistent value fields', async () => {
    const token = await login(clientEmail);
    const response = await request(app.getHttpServer())
      .get('/api/v1/portfolios')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(response.body.holdings)).toBe(true);
    expect(response.body.currentPaise).toBe(
      response.body.investedPaise + response.body.gainPaise,
    );
  });

  it('creates, lists, updates, and deletes an investor goal', async () => {
    const token = await login(clientEmail);
    const name = `E2E goal ${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        targetAmountPaise: 5000000,
        horizonMonths: 36,
        expectedAnnualReturnBps: 1200,
      })
      .expect(201);

    const goalId = created.body.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${name} updated` })
      .expect(200);

    const goals = await request(app.getHttpServer())
      .get('/api/v1/goals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(goals.body.some((goal: { id: string }) => goal.id === goalId)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('creates an idempotent transaction and lists it once', async () => {
    const token = await login(clientEmail);
    const assets = await request(app.getHttpServer())
      .get('/api/v1/assets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(assets.body.length).toBeGreaterThan(0);

    const body = {
      assetSlug: assets.body[0].slug as string,
      type: 'BUY',
      amountPaise: 100000,
      idempotencyKey: `e2e-${Date.now()}`,
    };
    const first = await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it('does not allow a client to view advisor-client data', async () => {
    const token = await login(clientEmail);
    await request(app.getHttpServer())
      .get('/api/v1/users/advisor-clients')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
