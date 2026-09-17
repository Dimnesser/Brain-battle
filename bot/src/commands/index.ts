import type { Bot } from 'grammy';
import { formatCoins, levelProgress } from '@nexus/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { ensureUser } from '../api.js';
import { mainKeyboard, referralKeyboard, sectionKeyboard } from '../keyboards.js';

const HELP = [
  '<b>NEXUS — команды</b>',
  '',
  '/start — открыть игру',
  '/profile — профиль и баланс',
  '/cases — список кейсов',
  '/bonus — доступные бонусы',
  '/referral — реферальная ссылка',
  '/rating — топ игроков',
  '/promo — активация промокода',
  '/help — эта справка',
].join('\n');

async function findUser(telegramId: number) {
  return prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
}

export function registerCommands(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const startParam = ctx.match?.trim() || undefined;

    const result = await ensureUser({
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
      startParam,
    });

    const greeting = result.created
      ? [
          '⚡️ <b>Добро пожаловать в NEXUS</b>',
          '<i>PLAY • OPEN • WIN</i>',
          '',
          result.startBonus > 0 ? `🎁 Стартовый бонус: <b>${formatCoins(result.startBonus)} B</b>` : '',
          '',
          'Открывай кейсы, забирай награды и поднимайся в рейтинге.',
        ]
      : [
          '⚡️ <b>С возвращением в NEXUS</b>',
          '',
          `💰 Баланс: <b>${formatCoins(result.user.balance)} B</b>`,
          `🔥 Серия входов: <b>${result.streak}</b> дн.`,
          '',
          'Бесплатный кейс и ежедневный бонус ждут внутри.',
        ];

    await ctx.reply(greeting.filter(Boolean).join('\n'), {
      parse_mode: 'HTML',
      reply_markup: mainKeyboard(),
    });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(HELP, { parse_mode: 'HTML', reply_markup: mainKeyboard() });
  });

  bot.command('profile', async (ctx) => {
    const user = ctx.from ? await findUser(ctx.from.id) : null;
    if (!user) return ctx.reply('Сначала запустите /start');

    const progress = levelProgress(user.xp);
    const referrals = await prisma.user.count({ where: { referredById: user.id } });

    const text = [
      '👤 <b>Профиль</b>',
      '',
      `Имя: <b>${user.username ? `@${user.username}` : user.firstName ?? 'Игрок'}</b>`,
      `ID: <code>${user.telegramId.toString()}</code>`,
      `Уровень: <b>${progress.level}</b> (${progress.percent}%)`,
      '',
      `💰 Баланс: <b>${formatCoins(user.balance)} B</b>`,
      `🎁 Открыто кейсов: <b>${user.casesOpened}</b>`,
      `🏆 Всего выиграно: <b>${formatCoins(user.totalWon)} B</b>`,
      `👥 Рефералов: <b>${referrals}</b>`,
    ].join('\n');

    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: sectionKeyboard('👤 Открыть профиль', '/profile') });
  });

  bot.command('cases', async (ctx) => {
    const cases = await prisma.case.findMany({
      where: { isActive: true },
      include: { rewards: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
      take: 10,
    });

    if (cases.length === 0) return ctx.reply('Кейсы скоро появятся.');

    const lines = cases.map((item) => {
      const max = item.rewards.length ? Math.max(...item.rewards.map((r) => r.amount)) : 0;
      const price = item.price === 0 ? 'бесплатно' : `${formatCoins(item.price)} B`;
      return `${item.image} <b>${item.name}</b> — ${price} · до ${formatCoins(max)} B`;
    });

    return ctx.reply(['🎁 <b>Кейсы</b>', '', ...lines].join('\n'), {
      parse_mode: 'HTML',
      reply_markup: sectionKeyboard('🎁 Открыть кейсы', '/cases'),
    });
  });

  bot.command('bonus', async (ctx) => {
    const user = ctx.from ? await findUser(ctx.from.id) : null;
    if (!user) return ctx.reply('Сначала запустите /start');

    const today = new Date().toISOString().slice(0, 10);
    const claimed = await prisma.bonusClaim.findUnique({
      where: { userId_type_periodKey: { userId: user.id, type: 'DAILY', periodKey: today } },
      select: { id: true },
    });

    const text = [
      '🎯 <b>Бонусы</b>',
      '',
      claimed ? '✅ Ежедневный бонус сегодня уже получен' : '🎁 Ежедневный бонус доступен',
      `🔥 Серия входов: <b>${user.loginStreak}</b> дн.`,
      '',
      'Бесплатный кейс, серия входов и бонус за подписку — в приложении.',
    ].join('\n');

    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: sectionKeyboard('🎯 Забрать бонусы', '/bonuses') });
  });

  bot.command('referral', async (ctx) => {
    const user = ctx.from ? await findUser(ctx.from.id) : null;
    if (!user) return ctx.reply('Сначала запустите /start');

    const invited = await prisma.user.count({ where: { referredById: user.id } });
    const link = `https://t.me/${env.BOT_USERNAME}?start=ref_${user.referralCode}`;

    const text = [
      '👥 <b>Реферальная программа</b>',
      '',
      `Приглашено: <b>${invited}</b>`,
      `Заработано: <b>${formatCoins(user.referralEarned)} B</b>`,
      '',
      'Твоя ссылка:',
      `<code>${link}</code>`,
    ].join('\n');

    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: referralKeyboard(link) });
  });

  bot.command('rating', async (ctx) => {
    const top = await prisma.user.findMany({
      where: { isBanned: false, totalWon: { gt: 0 } },
      orderBy: { totalWon: 'desc' },
      take: 10,
      select: { username: true, firstName: true, totalWon: true },
    });

    if (top.length === 0) return ctx.reply('Рейтинг пока пуст — стань первым!');

    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((user, index) => {
      const place = medals[index] ?? `${index + 1}.`;
      const name = user.username ? `@${user.username}` : user.firstName ?? 'Игрок';
      return `${place} ${name} — <b>${formatCoins(user.totalWon)} B</b>`;
    });

    return ctx.reply(['🏆 <b>Топ по выигрышам</b>', '', ...lines].join('\n'), {
      parse_mode: 'HTML',
      reply_markup: sectionKeyboard('🏆 Открыть рейтинг', '/leaderboard'),
    });
  });

  bot.command('promo', async (ctx) => {
    await ctx.reply(
      ['🎟 <b>Промокоды</b>', '', 'Активация промокодов доступна в приложении — раздел «Профиль» → «Промокод».'].join('\n'),
      { parse_mode: 'HTML', reply_markup: sectionKeyboard('🎟 Ввести промокод', '/promo') },
    );
  });
}
