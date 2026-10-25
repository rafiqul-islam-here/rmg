# ThreadFlow web
#
# Targets:
#   runner  production image (Next.js standalone server)     ← used by `docker compose up`
#   test    lint + typecheck + unit/API/component tests       ← fails the build if anything fails
#   e2e     Playwright browser tests against a running server ← `docker compose --profile test`

# ---- 1. Install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. Static checks + unit tests ----
FROM deps AS test
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 CI=1
RUN npm run lint && npm run typecheck && npm test

# ---- 3. Build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into the client bundle at build time. Empty = use the built-in mock API.
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 4. Browser tests (official Playwright image: Node + Chromium + system libs) ----
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS e2e
WORKDIR /e2e
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY playwright.config.ts tsconfig.json ./
COPY tests/e2e ./tests/e2e
# Point at the app container; use Playwright's bundled Chromium (no Google Chrome in Linux images).
ENV CI=1 E2E_CHANNEL=chromium E2E_BASE_URL=http://web:3000
CMD ["npx", "playwright", "test"]

# ---- 5. Run (production) ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
