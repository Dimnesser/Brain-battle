import { ERROR_CODES, type ErrorCode } from '@nexus/shared';

/** Ошибка бизнес-логики с кодом, который понимает клиент. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode | string;
  readonly details?: unknown;

  constructor(code: ErrorCode | string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const errors = {
  unauthorized: (message = 'Требуется авторизация') => new AppError(ERROR_CODES.UNAUTHORIZED, message, 401),
  forbidden: (message = 'Недостаточно прав') => new AppError(ERROR_CODES.FORBIDDEN, message, 403),
  notFound: (message = 'Не найдено') => new AppError(ERROR_CODES.NOT_FOUND, message, 404),
  validation: (message = 'Некорректные данные', details?: unknown) =>
    new AppError(ERROR_CODES.VALIDATION, message, 422, details),
  insufficientFunds: (message = 'Недостаточно средств на балансе') =>
    new AppError(ERROR_CODES.INSUFFICIENT_FUNDS, message, 400),
  cooldown: (seconds: number, message = 'Ещё рано') =>
    new AppError(ERROR_CODES.COOLDOWN, message, 429, { availableInSeconds: seconds }),
  alreadyClaimed: (message = 'Награда уже получена') => new AppError(ERROR_CODES.ALREADY_CLAIMED, message, 409),
  banned: (message = 'Аккаунт заблокирован') => new AppError(ERROR_CODES.BANNED, message, 403),
  internal: (message = 'Внутренняя ошибка') => new AppError(ERROR_CODES.INTERNAL, message, 500),
};
