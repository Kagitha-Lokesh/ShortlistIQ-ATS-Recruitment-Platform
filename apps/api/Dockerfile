FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/engine/package*.json ./packages/engine/
COPY apps/api/package*.json ./apps/api/

RUN npm ci

COPY packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

RUN npm run build --workspace=@shortlistiq/api

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/engine/package*.json ./packages/engine/
COPY apps/api/package*.json ./apps/api/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@shortlistiq/api"]

