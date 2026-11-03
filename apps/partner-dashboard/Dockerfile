FROM node:20-alpine AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/partner-dashboard/package.json apps/partner-dashboard/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui-core/package.json packages/ui-core/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @wealthos/shared-types build \
    && pnpm --filter partner-dashboard build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/partner-dashboard ./apps/partner-dashboard
COPY --from=build /app/packages ./packages
EXPOSE 3000
CMD ["pnpm", "--filter", "partner-dashboard", "start"]
