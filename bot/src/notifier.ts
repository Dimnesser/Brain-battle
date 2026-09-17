import type { Bot } from 'grammy';
import { GrammyError } from 'grammy';
import { prisma } from './db.js';
import { env } from './env.js';
import { mainKeyboard } from './keyboards.js';

const BATCH_SIZE = 20;

/**
 * Воркер рассылки уведомлений.
 * Сервер только складывает записи в таблицу notifications — доставкой
 * занимается бот, поэтому недоступность Telegram не ломает игровые запросы.
 */
export function startNotifier(bot: Bot): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async (): Promise<void> => {
    try {
      const pending = await prisma.notification.findMany({
        where: { isSent: false },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
        include: { user: { select: { telegramId: true, isBanned: true } } },
      });

      for (const notification of pending) {
        // Помечаем отправленным до вызова API: повторная доставка
        // раздражает игрока сильнее, чем потерянное уведомление
        const claimed = await prisma.notification.updateMany({
          where: { id: notification.id, isSent: false },
          data: { isSent: true, sentAt: new Date() },
        });
        if (claimed.count === 0) continue;
        if (notification.user.isBanned) continue;

        try {
          await bot.api.sendMessage(
            notification.user.telegramId.toString(),
            `<b>${escapeHtml(notification.title)}</b>\n\n${escapeHtml(notification.body)}`,
            { parse_mode: 'HTML', reply_markup: mainKeyboard() },
          );
        } catch (error) {
          if (error instanceof GrammyError && (error.error_code === 403 || error.error_code === 400)) {
            // Пользователь заблокировал бота — не повод ретраить
            console.warn(`[notifier] доставка невозможна (${error.error_code}) для ${notification.id}`);
          } else {
            console.error('[notifier] ошибка отправки:', error);
          }
        }
      }
    } catch (error) {
      console.error('[notifier] ошибка цикла рассылки:', error);
    } finally {
      if (!stopped) timer = setTimeout(() => void tick(), env.NOTIFY_POLL_INTERVAL_MS);
    }
  };

  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
