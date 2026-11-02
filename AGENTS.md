# WealthOS Monorepo

## Setup
- Install: `pnpm install`
- Dev (all): `docker compose up -d && pnpm dev`
- Migrate: `pnpm --filter @wealthos/database prisma migrate dev`
- Seed: `pnpm --filter @wealthos/database prisma db seed`

## Commands
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Test: `pnpm test` (Vitest)
- Build: `pnpm build`
- E2E: `pnpm --filter backend-api test:e2e`

## Architecture
- Monorepo: pnpm workspaces
- `apps/backend-api` — NestJS, clean architecture (domain → application → infrastructure → presentation)
- `apps/partner-dashboard` — Next.js App Router, shadcn/ui
- `apps/investor-portal` — Next.js App Router, shadcn/ui
- `apps/mobile-app` — React Native (Expo)
- `packages/database` — Prisma schema, migrations, seeds
- `packages/shared-types` — shared TS interfaces, enums, constants
- `packages/ui-core` — shared Tailwind/shadcn components

## Code Style
- TypeScript strict mode, no `any`
- Named exports (default exports only for React components)
- NestJS: `@Injectable()` + constructor DI, no string tokens
- Money: integers (paise), never floats
- Dates: ISO 8601 UTC in DB, `dayjs` in app code
- File naming: kebab-case for files, PascalCase for classes

## Conventions
- API routes: RESTful, versioned under `/api/v1/`
- Auth: JWT Bearer; RBAC via `@Roles('advisor')` guard
- PII: AES-256-GCM at rest, never logged
- Migrations: `prisma migrate dev` only, never hand-edit generated SQL
- Feature flags: constants in `@wealthos/shared-types`

## Don't
- Don't edit `packages/database/prisma/migrations/` directly
- Don't add deps without updating root `pnpm-lock.yaml`
- Don't put business logic in controllers — services/modules only
- Don't store raw PII in logs or error messages
- Don't use `console.log` in production code — use NestJS Logger   