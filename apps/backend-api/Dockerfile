FROM node:20-alpine AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend-api/package.json apps/backend-api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm --filter @wealthos/shared-types build \
    && pnpm --filter @wealthos/database build \
    && pnpm --filter backend-api build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/backend-api ./apps/backend-api
COPY --from=build /app/packages/database ./packages/database
COPY --from=build /app/packages/shared-types ./packages/shared-types
RUN apk add --no-cache curl
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @wealthos/database prisma migrate deploy && node apps/backend-api/dist/main.js"]
