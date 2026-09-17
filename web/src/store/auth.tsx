import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserDto } from '@nexus/shared';
import { ApiError, api, getToken, setToken } from '../lib/api';
import { getWebApp, initTelegram } from '../lib/telegram';
import type { ReactElement } from 'react';

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  error: string | null;
  startBonus: number;
  refresh: () => Promise<void>;
  /** Локальное обновление после выигрыша — без лишнего запроса. */
  patchUser: (patch: Partial<UserDto>) => void;
  retry: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startBonus, setStartBonus] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const authenticate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const webApp = getWebApp();
      const initData = webApp?.initData ?? '';

      // Сессия уже есть — просто подтягиваем профиль
      if (getToken()) {
        try {
          const { user: existing } = await api.user.me();
          setUser(existing);
          setLoading(false);
          return;
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 401) throw err;
        }
      }

      const startParam = webApp?.initDataUnsafe?.start_param;

      const response = initData
        ? await api.auth.telegram({ initData, startParam })
        : await api.auth.telegram({
            // Вне Telegram работает только dev-вход (ALLOW_DEV_AUTH на сервере)
            devTelegramId: Number(import.meta.env.VITE_DEV_TELEGRAM_ID ?? 123456789),
            startParam: new URLSearchParams(window.location.search).get('ref') ?? undefined,
          });

      setToken(response.token);
      setUser(response.user);
      setStartBonus(response.startBonus ?? 0);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.humanMessage
          : 'Не удалось связаться с сервером. Проверьте, что API запущен.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    void authenticate();
  }, [authenticate, attempt]);

  const refresh = useCallback(async () => {
    try {
      const { user: fresh } = await api.user.me();
      setUser(fresh);
    } catch {
      // Молча: обновление профиля не должно ломать экран
    }
  }, []);

  const patchUser = useCallback((patch: Partial<UserDto>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      startBonus,
      refresh,
      patchUser,
      retry: () => setAttempt((v) => v + 1),
    }),
    [user, loading, error, startBonus, refresh, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth должен вызываться внутри AuthProvider');
  return context;
}

/** Профиль гарантированно загружен — удобно внутри защищённых экранов. */
export function useUser(): UserDto {
  const { user } = useAuth();
  if (!user) throw new Error('Профиль ещё не загружен');
  return user;
}
