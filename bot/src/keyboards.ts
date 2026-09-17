import { InlineKeyboard } from 'grammy';
import { env } from './env.js';

const webAppUrl = env.WEBAPP_URL.replace(/\/$/, '');

/** Telegram требует https для web_app — локально отдаём обычную ссылку. */
function webAppButton(keyboard: InlineKeyboard, label: string, path = '/'): InlineKeyboard {
  const url = `${webAppUrl}${path}`;
  return url.startsWith('https://') ? keyboard.webApp(label, url) : keyboard.url(label, url);
}

export function mainKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  webAppButton(keyboard, '🎮 ОТКРЫТЬ ИГРУ');
  keyboard.row();
  webAppButton(keyboard, '🎁 Кейсы', '/cases');
  webAppButton(keyboard, '🎯 Бонусы', '/bonuses');
  keyboard.row();
  webAppButton(keyboard, '🏆 Рейтинг', '/leaderboard');
  webAppButton(keyboard, '👤 Профиль', '/profile');
  return keyboard;
}

export function sectionKeyboard(label: string, path: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  webAppButton(keyboard, label, path);
  return keyboard;
}

export function referralKeyboard(link: string): InlineKeyboard {
  const text = encodeURIComponent('Заходи в NEXUS — открывай кейсы и забирай награды 🎁');
  return new InlineKeyboard()
    .url('📤 Пригласить друзей', `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`)
    .row();
}
