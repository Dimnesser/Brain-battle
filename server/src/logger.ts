import { env, isProduction } from './env.js';

/** Ключи, которые никогда не должны попасть в логи. */
const REDACTED = [
  'requisites',
  'initData',
  'token',
  'authorization',
  'password',
  'providerToken',
  'payment_secret',
  'card',
];

export const loggerOptions = {
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.initData',
      'body.requisites',
      ...REDACTED.map((k) => `*.${k}`),
    ],
    censor: '[скрыто]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
};

/** Приватные платёжные данные логируем только в замаскированном виде. */
export function safeRequisites(value: string): string {
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}
