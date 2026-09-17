# ─── Сборка ───────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Сначала манифесты — слой с зависимостями кешируется между сборками
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY bot/package.json bot/
COPY web/package.json web/
RUN npm ci --ignore-scripts

COPY prisma ./prisma
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server

RUN npx prisma generate
RUN npm run build -w @nexus/server

# ─── Рантайм ──────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY bot/package.json bot/
COPY web/package.json web/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/server/dist ./server/dist

USER node
EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/dist/index.cjs"]
