# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for deterministic layer caching
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

# Copy workspace sources and build the React/Vite client bundle
COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/meo-no.sqlite

# Install production workspace dependencies only
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy runtime sources and built client assets
COPY shared ./shared
COPY server ./server
COPY --from=builder /app/client/dist ./client/dist

# Ensure SQLite data directory exists and is writable by non-root user
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.mjs"]
