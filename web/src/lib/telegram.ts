/** Минимальная типизация Telegram WebApp API — без внешних зависимостей. */

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: { id: number; first_name?: string; username?: string; photo_url?: string };
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  const app = getWebApp();
  return Boolean(app && app.initData.length > 0);
}

/** Подготовка окна: раскрытие на весь экран и фирменные цвета. */
export function initTelegram(): void {
  const app = getWebApp();
  if (!app) return;

  app.ready();
  app.expand();
  app.setHeaderColor?.('#07060f');
  app.setBackgroundColor?.('#07060f');
  // Вертикальные свайпы закрывают приложение прямо во время анимации кейса
  app.disableVerticalSwipes?.();

  const syncViewport = (): void => {
    document.documentElement.style.setProperty('--tg-viewport-height', `${app.viewportHeight}px`);
  };
  syncViewport();
  app.onEvent('viewportChanged', syncViewport);
}

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  getWebApp()?.HapticFeedback?.impactOccurred(type);
}

export function hapticNotify(type: 'success' | 'error' | 'warning'): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(type);
}

/** Открытие ссылки: внутри Telegram — нативно, в браузере — новой вкладкой. */
export function openLink(url: string): void {
  const app = getWebApp();
  if (app && url.startsWith('https://t.me/')) {
    app.openTelegramLink(url);
    return;
  }
  if (app) {
    app.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

/** Диалог «Поделиться» Telegram. */
export function shareLink(url: string, text: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const app = getWebApp();
  if (app) app.openTelegramLink(shareUrl);
  else window.open(shareUrl, '_blank', 'noopener');
}
