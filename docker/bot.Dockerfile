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
COPY bot ./bot

RUN npx prisma generate
RUN npm run build -w @nexus/bot

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

COPY --from=build /app/bot/dist ./bot/dist

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "bot/dist/index.cjs"]
