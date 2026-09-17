import { Bot } from 'grammy';
import { env } from './env.js';
import { registerCommands } from './commands/index.js';

export function createBot(): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  registerCommands(bot);

  // Любое другое сообщение — мягкая подсказка, а не молчание
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    await ctx.reply('Не понял команду. Откройте игру кнопкой ниже или посмотрите /help.', {
      reply_markup: (await import('./keyboards.js')).mainKeyboard(),
    });
  });

  bot.catch((error) => {
    console.error('[bot] необработанная ошибка:', error.error);
  });

  return bot;
}

export const BOT_COMMANDS = [
  { command: 'start', description: 'Открыть игру' },
  { command: 'profile', description: 'Профиль и баланс' },
  { command: 'cases', description: 'Список кейсов' },
  { command: 'bonus', description: 'Бонусы' },
  { command: 'referral', description: 'Реферальная ссылка' },
  { command: 'rating', description: 'Топ игроков' },
  { command: 'promo', description: 'Промокод' },
  { command: 'help', description: 'Справка' },
];
