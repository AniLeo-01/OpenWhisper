FROM node:22-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output and static assets with correct ownership
COPY --from=base --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=base --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=base --chown=nextjs:nodejs /app/public ./public

USER nextjs

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
