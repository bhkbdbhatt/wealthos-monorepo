# WealthOS

WealthOS is a monorepo for wealth management and investment operations, with an API, partner dashboard, investor portal, mobile app, and shared packages.

## Repository layout

- `apps/backend-api` - NestJS API for the WealthOS domain engine
- `apps/website` - Static marketing website for WealthOS
- `apps/partner-dashboard` - Next.js partner dashboard, available on port 3000
- `apps/investor-portal` - Next.js investor portal, available on port 3001
- `apps/mobile-app` - React Native application built with Expo
- `packages/database` - Prisma schema, migrations, and seed data
- `packages/shared-types` - Shared TypeScript types, enums, constants, and money helpers
- `packages/ui-core` - Shared React and Tailwind UI components
- `deployment/` - Production Nginx configuration

## Prerequisites

- Node.js 20 or newer
- pnpm 12
- Docker with Docker Compose

## Local setup

1. Install dependencies:

```sh
pnpm install
```

2. Create the local environment file:

```sh
cp .env.example .env
```

Update `DATABASE_URL` and the other placeholders as needed. The API requires JWT secrets and uses `PII_ENCRYPTION_KEY` for AES-256-GCM encryption.

3. Start PostgreSQL and Redis:

```sh
docker compose up -d
```

4. Generate the Prisma client and apply migrations:

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

5. Start the development workspaces:

```sh
pnpm dev
```

The local service URLs are:

- Marketing website: `http://localhost:3002`
- API: `http://localhost:4000/api/v1`
- Partner dashboard: `http://localhost:3000`
- Investor portal: `http://localhost:3001`

## Common commands

```sh
pnpm dev          # Start all workspaces in development mode
pnpm build        # Build every workspace
pnpm typecheck    # Type-check every workspace
pnpm lint         # Lint every workspace
pnpm test         # Run workspace unit tests
pnpm test:e2e     # Run backend API end-to-end tests
pnpm db:generate  # Generate the Prisma client
pnpm db:migrate   # Create and apply a development migration
pnpm db:seed      # Seed development data
```

Run a command for one workspace with pnpm filtering, for example:

```sh
pnpm --filter backend-api dev
pnpm --filter partner-dashboard build
pnpm --filter @wealthos/database prisma studio
```

## Environment configuration

Use `.env.example` for local development and `.env.production.example` for production. The API configuration includes database and Redis connections, JWT signing settings, CORS origins, encryption keys, and KYC mock mode.

Generate a 32-byte encryption key:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Production deployment

Production deployment uses Docker Compose and Nginx. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for prerequisites, environment setup, domain configuration, and verification.

## Development conventions

- TypeScript strict mode; do not introduce `any`
- Keep domain and application business logic out of API controllers
- Store money as integer paise values, never floats
- Store database timestamps in UTC and use ISO 8601 values in applications
- Use NestJS `Logger` for production logging and never log raw PII
