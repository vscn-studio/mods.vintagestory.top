# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS prisma

COPY prisma ./prisma
RUN npx prisma generate

FROM prisma AS builder

WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM dependencies AS migrator

COPY prisma ./prisma

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && install -d -o nextjs -g nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-env.mjs ./scripts/validate-env.mjs
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3100
ENV PORT=3100

CMD ["sh", "-c", "node scripts/validate-env.mjs && exec node server.js"]
