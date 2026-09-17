import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@nexus/shared';
import { AppError } from '../errors.js';
import { isProduction } from '../env.js';

/** Единый формат ошибок API: { error: { code, message, details } }. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      // Ожидаемые ошибки бизнес-логики не засоряют error-лог
      request.log.debug({ code: error.code, msg: error.message }, 'бизнес-ошибка');
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: ERROR_CODES.VALIDATION,
          message: 'Проверьте введённые данные',
          details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        },
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      request.log.error({ code: error.code, meta: error.meta }, 'ошибка базы данных');
      const status = error.code === 'P2025' ? 404 : 409;
      return reply.status(status).send({
        error: {
          code: error.code === 'P2025' ? ERROR_CODES.NOT_FOUND : ERROR_CODES.VALIDATION,
          message: error.code === 'P2025' ? 'Запись не найдена' : 'Конфликт данных',
        },
      });
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({
        error: { code: ERROR_CODES.RATE_LIMIT, message: 'Слишком много запросов. Попробуйте позже' },
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) request.log.error({ err: error }, 'необработанная ошибка');

    return reply.status(statusCode).send({
      error: {
        code: ERROR_CODES.INTERNAL,
        message:
          isProduction || statusCode >= 500 ? 'Что-то пошло не так' : (error as Error).message,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: ERROR_CODES.NOT_FOUND, message: `Маршрут ${request.method} ${request.url} не найден` },
    });
  });
}
