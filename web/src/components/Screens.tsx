import { APP_NAME, APP_TAGLINE } from '@nexus/shared';
import { Button } from './ui';
import type { ReactElement } from 'react';

/** Заставка на время авторизации. */
export function SplashScreen(): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-8">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse-glow rounded-full bg-primary/40 blur-3xl" />
        <div className="relative font-display text-5xl font-extrabold tracking-tight text-gradient">{APP_NAME}</div>
      </div>
      <p className="text-[11px] uppercase tracking-[0.36em] text-text-muted">{APP_TAGLINE}</p>
      <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-primary to-secondary" />
      </div>
    </div>
  );
}

/** Экран ошибки авторизации с возможностью повтора. */
export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="font-display text-xl font-bold">Не удалось войти</h1>
      <p className="max-w-[300px] text-[13px] text-text-muted">{message}</p>
      <Button onClick={onRetry}>Попробовать снова</Button>
      <p className="max-w-[320px] text-[11px] leading-relaxed text-text-muted/70">
        Если вы открыли приложение в браузере, включите ALLOW_DEV_AUTH=true в .env и перезапустите сервер.
      </p>
    </div>
  );
}
