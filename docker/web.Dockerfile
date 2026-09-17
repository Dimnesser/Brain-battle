# ─── Сборка статики ───────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL=""
ARG VITE_DEV_TELEGRAM_ID=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEV_TELEGRAM_ID=$VITE_DEV_TELEGRAM_ID

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY bot/package.json bot/
COPY web/package.json web/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY shared ./shared
COPY web ./web

RUN npm run build -w @nexus/web

# ─── Раздача ──────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
