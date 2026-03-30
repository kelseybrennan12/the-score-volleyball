FROM node:22.22.0-alpine3.23 AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY tsconfig.json tsconfig.backend.json drizzle.config.ts ./
COPY src ./src

RUN pnpm run build:app

FROM deps AS app-base

COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
COPY src ./src

CMD ["pnpm", "run", "app:api"]

FROM caddy:2.10.2-alpine AS app-edge

COPY infra/docker/Caddyfile.app /etc/caddy/Caddyfile
COPY --from=build /app/dist/frontend /srv

ENV EDGE_PORT=8080
ENV API_UPSTREAM=http://app-api:3000

EXPOSE 8080

FROM mcr.microsoft.com/playwright:v1.58.2-jammy AS playwright-runner

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.backend.json drizzle.config.ts playwright.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
COPY scripts ./scripts

CMD ["pnpm", "run", "test:e2e"]

FROM node:22.22.0-alpine3.23 AS dev-backend

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.backend.json drizzle.config.ts ./
COPY src ./src

CMD ["pnpm", "run", "dev:api"]

FROM node:22.22.0-alpine3.23 AS dev-frontend

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile=false

COPY tsconfig.json ./
COPY src ./src

CMD ["pnpm", "run", "dev:frontend"]

FROM caddy:2.10.2-alpine AS dev-edge

COPY infra/docker/Caddyfile.dev /etc/caddy/Caddyfile

ENV EDGE_PORT=3000

EXPOSE 3000
