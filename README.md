# ⚡ NEXUS — игровая платформа для Telegram

> **PLAY • OPEN • WIN**

Telegram Mini App с внутренней валютой, кейсами, бонусами, промокодами, реферальной
программой, пополнением, выводом средств и админ-панелью.

Проект собран как production-ready монорепозиторий: отдельные сервисы для API, бота и
веб-приложения, единая схема БД на Prisma и общие типы между сервером и клиентом.

---

## Содержание

1. [Возможности](#возможности)
2. [Архитектура](#архитектура)
3. [Быстрый старт](#быстрый-старт)
4. [Шаг 1. Node.js](#шаг-1-установка-nodejs)
5. [Шаг 2. Зависимости](#шаг-2-установка-зависимостей)
6. [Шаг 3. PostgreSQL](#шаг-3-запуск-postgresql)
7. [Шаг 4. Файл .env](#шаг-4-настройка-env)
8. [Шаг 5–7. База данных](#шаг-5-7-база-данных-миграции-и-seed)
9. [Шаг 8–10. Запуск](#шаг-8-10-запуск-backend-frontend-и-бота)
10. [Шаг 11. Подключение WebApp к боту](#шаг-11-подключение-webapp-к-telegram-боту)
11. [Шаг 12. Production build](#шаг-12-production-build)
12. [Docker](#запуск-через-docker)
13. [API](#api)
14. [Безопасность](#безопасность)
15. [Экономика и вероятности](#экономика-и-вероятности)
16. [Платёжные провайдеры](#платёжные-провайдеры)
17. [Частые проблемы](#частые-проблемы)

---

## Возможности

| Раздел | Что умеет |
| --- | --- |
| 👤 Профиль | уровень, XP, статистика, история операций |
| 💰 Баланс | внутренняя валюта `B`, анимация изменения баланса |
| 🎁 Кейсы | категории, вероятности из БД, анимация открытия |
| 🆓 Бесплатный кейс | раз в 24 часа, кулдаун проверяется на сервере |
| 🎯 Бонусы | ежедневный, серия входов, подписка, рефералы |
| 🎟 Промокоды | монеты, XP или процент к пополнению, лимиты активаций |
| 👥 Рефералы | ссылка-приглашение, бонус обеим сторонам, 10% с пополнений |
| 🏆 Рейтинг | по выигрышам, балансу, кейсам и рефералам |
| 🔥 Лента выигрышей | real-time через WebSocket |
| 💳 Пополнение | абстракция провайдера: mock, Telegram Payments, любой другой |
| 🏦 Вывод | заявки с модерацией, возврат средств при отказе |
| 🔔 Уведомления | сервер пишет в БД, бот доставляет в Telegram |
| 🛡 Админ-панель | статистика, игроки, кейсы, промокоды, выводы |

---

## Архитектура

```
nexus/
├── bot/          # Telegram-бот (grammY) + воркер рассылки уведомлений
├── server/       # REST API и WebSocket (Fastify + Prisma)
├── web/          # Telegram Mini App (React + Vite + TailwindCSS)
├── shared/       # Общие типы, константы и формулы уровней
├── prisma/       # Схема БД, миграции и seed
├── docker/       # Dockerfile-ы, nginx и docker-compose
├── .env.example
└── README.md
```

**Стек**

| Слой | Технологии |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, TailwindCSS, Framer Motion, React Query |
| Backend | Node.js 22, TypeScript, Fastify 5, WebSocket, Zod |
| База данных | PostgreSQL 16, Prisma ORM |
| Бот | grammY, Telegram Bot API |

**Принципы**

- Игровая логика целиком на сервере: клиент не участвует в выборе награды.
- Критические операции — в транзакциях PostgreSQL с блокировкой строки игрока.
- Общие типы в `shared/` не дают API и клиенту разойтись.
- Платёжный провайдер подключается через интерфейс, а не правкой бизнес-логики.

---

## Быстрый старт

```bash
git clone <repository-url> nexus && cd nexus
cp .env.example .env          # заполните BOT_TOKEN, DATABASE_URL, JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Откроется три процесса: API (`:4000`), бот и веб-приложение (`:5173`).

---

## Шаг 1. Установка Node.js

Нужен **Node.js 20.11+** (рекомендуется 22 LTS).

**Через nvm (Linux/macOS):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

**Ubuntu/Debian без nvm:**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows / macOS:** установщик с [nodejs.org](https://nodejs.org/).

Проверка:

```bash
node -v   # v22.x
npm -v    # 10.x+
```

---

## Шаг 2. Установка зависимостей

В корне проекта (npm workspaces поставит зависимости всех пакетов сразу):

```bash
npm install
```

---

## Шаг 3. Запуск PostgreSQL

**Вариант A — Docker (проще всего):**

```bash
docker run --name nexus-db -e POSTGRES_USER=nexus -e POSTGRES_PASSWORD=nexus \
  -e POSTGRES_DB=nexus -p 5432:5432 -d postgres:16-alpine
```

**Вариант B — системный PostgreSQL:**

```bash
sudo apt-get install -y postgresql postgresql-contrib   # Ubuntu/Debian
brew install postgresql@16 && brew services start postgresql@16   # macOS

sudo -u postgres psql -c "CREATE USER nexus WITH PASSWORD 'nexus';"
sudo -u postgres psql -c "CREATE DATABASE nexus OWNER nexus;"
```

Проверка подключения:

```bash
psql postgresql://nexus:nexus@localhost:5432/nexus -c "SELECT version();"
```

---

## Шаг 4. Настройка .env

```bash
cp .env.example .env
```

Минимально необходимые переменные:

| Переменная | Описание |
| --- | --- |
| `BOT_TOKEN` | токен от [@BotFather](https://t.me/BotFather) |
| `BOT_USERNAME` | username бота без `@` — используется в реферальных ссылках |
| `WEBAPP_URL` | публичный **https**-адрес мини-приложения |
| `DATABASE_URL` | строка подключения к PostgreSQL |
| `JWT_SECRET` | случайная строка ≥ 32 символов: `openssl rand -hex 32` |
| `INTERNAL_API_TOKEN` | общий секрет бота и API: `openssl rand -hex 24` |
| `ADMIN_TELEGRAM_ID` | ваш Telegram ID (узнать: [@userinfobot](https://t.me/userinfobot)) |
| `PAYMENT_PROVIDER` | `mock` для разработки, `telegram` для Telegram Payments |
| `ALLOW_DEV_AUTH` | `true` — вход без Telegram для локальной разработки |

> ⚠️ `ALLOW_DEV_AUTH=true` в production запрещён — сервер не стартует с такой
> конфигурацией, потому что этот режим позволяет войти под любым пользователем.

---

## Шаг 5-7. База данных: миграции и seed

```bash
npm run db:generate      # сгенерировать Prisma Client
npm run db:migrate       # применить миграции (prisma migrate deploy)
npm run db:seed          # 7 кейсов, 42 награды, 4 промокода, админ
```

Дополнительно:

```bash
npm run db:migrate:dev   # создать новую миграцию после правки schema.prisma
npm run db:studio        # веб-интерфейс к базе на :5555
npm run db:reset         # полный сброс базы (удалит все данные)
```

После seed доступны промокоды `WELCOME`, `BONUS100`, `SUMMER`, `NEXUSXP`.

---

## Шаг 8-10. Запуск backend, frontend и бота

Всё сразу:

```bash
npm run dev
```

По отдельности:

```bash
npm run dev:server   # API на http://localhost:4000
npm run dev:web      # Mini App на http://localhost:5173
npm run dev:bot      # Telegram-бот (long polling)
```

Проверка API:

```bash
curl http://localhost:4000/health
```

Для разработки вне Telegram откройте `http://localhost:5173` — при
`ALLOW_DEV_AUTH=true` приложение войдёт под `VITE_DEV_TELEGRAM_ID`. Если указать там
значение `ADMIN_TELEGRAM_ID`, будет доступна и админ-панель (`/admin`).

---

## Шаг 11. Подключение WebApp к Telegram-боту

Telegram принимает только **https**-адреса. Локально удобно использовать туннель:

```bash
npx localtunnel --port 5173     # или ngrok http 5173
```

1. Впишите полученный адрес в `WEBAPP_URL` и `VITE_API_URL` (если API тоже снаружи).
2. Перезапустите `npm run dev`.
3. В [@BotFather](https://t.me/BotFather):
   - `/mybots` → ваш бот → **Bot Settings → Menu Button → Configure menu button**
   - укажите URL мини-приложения и текст кнопки, например `🎮 ОТКРЫТЬ ИГРУ`.
4. Отправьте боту `/start` — кнопка откроет приложение внутри Telegram.

> Пока `WEBAPP_URL` не начинается с `https://`, бот присылает обычную ссылку вместо
> кнопки WebApp — это ожидаемое поведение для локальной разработки.

---

## Шаг 12. Production build

```bash
npm run build     # сборка server, bot и web
npm run start     # запуск API и бота
```

Результат сборки:

- `server/dist/index.cjs` — API-сервер
- `bot/dist/index.cjs` — Telegram-бот
- `web/dist/` — статика мини-приложения (отдаётся nginx или любым CDN)

Пример деплоя на VPS:

```bash
git clone <repository-url> /opt/nexus && cd /opt/nexus
cp .env.example .env && nano .env        # NODE_ENV=production, ALLOW_DEV_AUTH=false
npm ci
npm run db:migrate
npm run db:seed
npm run build
npm run start                            # лучше под systemd или pm2
```

---

## Запуск через Docker

```bash
cp .env.example .env    # заполните BOT_TOKEN, JWT_SECRET, ADMIN_TELEGRAM_ID
npm run docker:up       # docker compose -f docker/docker-compose.yml up -d --build
```

Поднимутся: `postgres`, разовые миграции, `server` (`:4000`), `bot` и `web` (`:8080`).
`DATABASE_URL` внутри compose подставляется автоматически.

```bash
npm run docker:logs     # логи всех сервисов
npm run docker:down     # остановить
```

Seed внутри контейнера:

```bash
docker compose -f docker/docker-compose.yml exec server npx prisma db seed
```

---

## API

Все игровые маршруты требуют заголовок `Authorization: Bearer <token>`,
который выдаётся после проверки Telegram `initData`.

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| POST | `/api/auth/telegram` | вход по `initData`, выдача JWT |
| GET | `/api/user` | профиль и статистика |
| GET | `/api/transactions` · `/api/user/transactions` | история операций |
| GET | `/api/cases` | список кейсов (фильтр `?category=`) |
| GET | `/api/cases/:id` | кейс с наградами и шансами |
| POST | `/api/cases/:id/open` | открыть кейс |
| GET | `/api/bonus` | бонусы, акция дня, серия входов |
| POST | `/api/bonus/claim` | забрать бонус |
| POST | `/api/promo/redeem` | активировать промокод |
| GET | `/api/referrals` | реферальная статистика и ссылка |
| GET | `/api/leaderboard` | рейтинг (`?metric=wins\|balance\|cases\|referrals`) |
| GET | `/api/deposit` · POST | история пополнений · создать платёж |
| GET | `/api/withdrawal` · POST | заявки на вывод · создать заявку |
| GET | `/api/wins` | лента крупных выигрышей |
| WS | `/ws` | real-time лента выигрышей |

**Админ-API** (только для `isAdmin`):

| Метод | Маршрут |
| --- | --- |
| GET | `/api/admin/stats` |
| GET | `/api/admin/users` |
| POST | `/api/admin/users/:id/balance` · `/api/admin/users/:id/ban` |
| GET/POST/PATCH/DELETE | `/api/admin/cases` · `/api/admin/cases/:id` |
| GET/POST | `/api/admin/promocodes` |
| GET | `/api/admin/deposits` · `/api/admin/withdrawals` |
| POST | `/api/admin/withdrawals/:id/approve` · `/reject` |

Формат ошибок одинаков для всех маршрутов:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "Недостаточно средств на балансе" } }
```

---

## Безопасность

- **Проверка Telegram initData.** Подпись HMAC-SHA256 по секрету бота, сравнение
  постоянного времени, контроль срока жизни `auth_date`. Ни одно поле от клиента не
  принимается на веру.
- **Ничего не решает клиент.** Баланс, цена кейса, вероятности, награда, уровень и
  флаг администратора вычисляются сервером. Изменить их через DevTools нельзя.
- **Награда выбирается на сервере** криптостойким ГПСЧ (`crypto.randomInt`) по весам
  из БД. Клиент получает уже записанный в базу результат вместе с лентой для анимации.
- **Транзакции и гонки.** Открытие кейса, депозит, вывод, промокод и реферальный
  бонус выполняются в транзакции PostgreSQL с `SELECT ... FOR UPDATE` по строке игрока.
  Списание идёт условным `UPDATE ... WHERE balance >= price`, поэтому параллельные
  запросы не уводят баланс в минус.
  Проверено: 6 одновременных открытий кейса при балансе ровно на одно — успешно
  ровно одно, остальные получают `INSUFFICIENT_FUNDS`.
- **Повторные начисления.** Уникальный индекс `(userId, type, periodKey)` в
  `bonus_claims` делает повторный запрос бонуса невозможным даже при гонке.
  Webhook платежа идемпотентен: зачисление происходит только для депозита в статусе
  `PENDING`.
- **Права администратора** перечитываются из БД при каждом запросе, а не берутся
  из токена: отзыв прав и бан действуют немедленно.
- **Rate limiting.** 240 запросов/мин на игрока, отдельные лимиты на открытие кейса
  (30/мин), бонусы (20/мин), промокоды (10/мин) и вывод (10 / 5 мин).
- **Валидация.** Все тела запросов и query-параметры проходят через Zod.
  SQL-инъекции исключены параметризованными запросами Prisma.
- **Заголовки** выставляет `@fastify/helmet`; CORS ограничен списком `CORS_ORIGIN`.
- **Логи.** Пишутся ошибки, платежи, открытия кейсов, изменения баланса, действия
  администраторов и выводы. Реквизиты, токены и `initData` маскируются и никогда не
  попадают в логи и в аудит.

---

## Экономика и вероятности

Вероятности хранятся в таблице `case_rewards` и нормализуются на сервере — сумма весов
не обязана равняться 100. Администратор меняет их из админ-панели, которая сразу
показывает пересчитанный RTP.

Все платные кейсы из seed настроены на **RTP ≈ 90%** (возврат игроку), то есть
маржа платформы составляет около 10% оборота:

| Кейс | Цена | Наград | Максимум | RTP |
| --- | --- | --- | --- | --- |
| DAILY DROP | бесплатно | 5 | 500 B | — |
| NIGHT CITY | 50 B | 6 | 5 000 B | 90% |
| CYBER CASE | 100 B | 7 | 10 000 B | 90% |
| NEON CASE | 250 B | 6 | 15 000 B | 90% |
| GALAXY CASE | 500 B | 6 | 25 000 B | 90% |
| INFERNO CASE | 1 500 B | 6 | 75 000 B | 90% |
| LEGEND CASE | 5 000 B | 6 | 250 000 B | 90% |

**Уровни.** XP начисляется за открытие кейсов, ежедневный вход, рефералов и
пополнения. Пороги: уровень 2 — 100 XP, 3 — 300, 4 — 700 (далее рост замедляется,
максимум — 60-й уровень). Уровень — производная от XP и не может быть задан извне.

---

## Платёжные провайдеры

Бизнес-логика работает только с интерфейсом `PaymentProvider`
(`server/src/payments/provider.ts`):

```ts
export interface PaymentProvider {
  readonly id: string;
  readonly title: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  verifyWebhook(headers: Headers, body: unknown): Promise<WebhookVerification>;
}
```

В комплекте два провайдера: `mock` (разработка) и `telegram` (Telegram Payments).
Чтобы добавить YooKassa, CryptoBot или другой эквайринг, создайте класс с этим
интерфейсом и зарегистрируйте его в `server/src/payments/index.ts` — остальной код
менять не нужно.

Подтверждение тестового платежа локально:

```bash
curl -X POST http://localhost:4000/api/payments/webhook/mock \
  -H 'content-type: application/json' \
  -H "x-payment-secret: $PAYMENT_SECRET" \
  -d '{"providerRef":"mock_...","status":"PAID"}'
```

---

## Частые проблемы

| Симптом | Причина и решение |
| --- | --- |
| `Некорректная конфигурация окружения` | не заполнен `.env` — сверьтесь с `.env.example` |
| `нет подключения к базе данных` | PostgreSQL не запущен или неверный `DATABASE_URL` |
| `Вход без Telegram отключён` | установите `ALLOW_DEV_AUTH=true` (только для разработки) |
| `Подпись Telegram не совпадает` | `BOT_TOKEN` в `.env` не тот, от которого открыт WebApp |
| Бот присылает ссылку вместо кнопки | `WEBAPP_URL` должен начинаться с `https://` |
| `403` в админке | ваш Telegram ID не указан в `ADMIN_TELEGRAM_ID`; после правки перезапустите API и выполните `npm run db:seed` |
| Не приходят уведомления | процесс бота не запущен — он забирает их из таблицы `notifications` |
| CORS-ошибка в браузере | добавьте адрес фронтенда в `CORS_ORIGIN` |

---

## Полезные команды

```bash
npm run dev          # всё окружение разработки
npm run build        # production-сборка
npm run start        # запуск собранных API и бота
npm run typecheck    # проверка типов во всех пакетах
npm run db:studio    # Prisma Studio
npm run docker:up    # поднять стенд в Docker
```

---

## Лицензия

MIT. Проект предназначен для образовательных и демонстрационных целей: перед
коммерческим запуском убедитесь, что игровая механика соответствует законодательству
вашей юрисдикции и правилам Telegram.
