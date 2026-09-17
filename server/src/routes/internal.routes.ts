import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { errors } from '../errors.js';
import { toUserDto, touchLogin, upsertTelegramUser } from '../services/user.service.js';
import { attachReferral } from '../services/referral.service.js';

const ensureSchema = z.object({
  telegramId: z.union([z.string(), z.number()]),
  username: z.string().max(64).nullish(),
  firstName: z.string().max(64).nullish(),
  lastName: z.string().max(64).nullish(),
  languageCode: z.string().max(8).nullish(),
  photoUrl: z.string().url().max(512).nullish(),
  startParam: z.string().max(64).nullish(),
});

function checkToken(provided: string | undefined): void {
  if (!env.INTERNAL_API_TOKEN) throw errors.forbidden('Внутренний API отключён');
  if (!provided) throw errors.forbidden('Нет внутреннего токена');

  const a = Buffer.from(provided);
  const b = Buffer.from(env.INTERNAL_API_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw errors.forbidden('Неверный внутренний токен');
}

/**
 * Служебные маршруты для бота.
 * Наружу не публикуются: доступ только по общему секрету INTERNAL_API_TOKEN,
 * чтобы создание пользователей оставалось в одном месте — на сервере.
 */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request) => {
    const header = request.headers['x-internal-token'];
    checkToken(Array.isArray(header) ? header[0] : header);
  });

  app.post('/users/ensure', async (request) => {
    const body = ensureSchema.parse(request.body ?? {});
    const id = Number(body.telegramId);
    if (!Number.isSafeInteger(id) || id <= 0) throw errors.validation('Некорректный telegramId');

    const { user, created, startBonus } = await upsertTelegramUser(
      {
        id,
        username: body.username ?? undefined,
        first_name: body.firstName ?? undefined,
        last_name: body.lastName ?? undefined,
        language_code: body.languageCode ?? undefined,
        photo_url: body.photoUrl ?? undefined,
      },
      body.startParam ?? undefined,
    );

    if (!created && body.startParam) await attachReferral(user.id, body.startParam);
    const { streak } = await touchLogin(user.id);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return { user: await toUserDto(fresh), created, startBonus, streak };
  });
}
