# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/engine/package.json ./packages/engine/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npm --workspace=@shortlistiq/api run db:generate

# Build shared packages and API
RUN npm run build --workspace=@shortlistiq/shared
RUN npm run build --workspace=@shortlistiq/engine
RUN npm run build --workspace=@shortlistiq/api

# Production Runner stage
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000
# Node memory limit recommendation for 512MB RAM free instances
ENV NODE_OPTIONS="--max-old-space-size=450"

# Non-root user for container security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 shortlistiq

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder --chown=shortlistiq:nodejs /app/package.json ./
COPY --from=builder --chown=shortlistiq:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=shortlistiq:nodejs /app/packages ./packages
COPY --from=builder --chown=shortlistiq:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=shortlistiq:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=shortlistiq:nodejs /app/apps/api/prisma ./apps/api/prisma

USER shortlistiq

EXPOSE 4000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Default start command runs the API Server
# To run as background worker, override command in deployment:
# ["node", "apps/api/dist/worker.js"]
CMD ["node", "apps/api/dist/index.js"]

