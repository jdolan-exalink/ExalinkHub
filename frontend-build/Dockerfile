# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 py3-pip build-base docker-cli
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
# Instalar Docker CLI y su-exec para poder ejecutar comandos docker desde el contenedor
RUN apk add --no-cache docker-cli su-exec
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir .next
RUN chown nextjs:nodejs .next
RUN mkdir -p DB data
RUN chown -R nextjs:nodejs DB data
# Instalar dependencias de producción necesarias
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=0 --chown=nextjs:nodejs /app/.next/standalone/ ./
RUN ls -la /app/server.js
COPY --from=0 --chown=nextjs:nodejs /app/.next/static ./.next/static
# No cambiar a usuario nextjs para mantener acceso al socket de Docker
# USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
