import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useCallback, useState } from 'react';
import type { CaseDetailDto, CaseDto, OpenCaseResult } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import { CaseOpener } from '../components/CaseOpener';
import type { ReactElement } from 'react';

/**
 * Общая логика открытия кейса для всех экранов:
 * подгружает детали кейса, показывает модалку и синхронизирует баланс.
 */
export function useCaseOpening(): {
  open: (item: CaseDto | { id: string; slug: string }) => Promise<void>;
  modal: ReactElement | null;
} {
  const { user, patchUser, refresh } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<CaseDetailDto | null>(null);

  const open = useCallback(
    async (item: CaseDto | { id: string; slug: string }) => {
      try {
        const { case: detail } = await api.cases.detail(item.slug);
        setActive(detail);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.humanMessage : 'Кейс недоступен');
      }
    },
    [toast],
  );

  const handleFinished = useCallback(
    (result: OpenCaseResult) => {
      // Баланс и уровень известны сразу из ответа — обновляем без запроса
      patchUser({ balance: result.balance, xp: result.xp, level: result.level });
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      void queryClient.invalidateQueries({ queryKey: ['wins'] });
      void queryClient.invalidateQueries({ queryKey: ['bonus'] });
    },
    [patchUser, queryClient],
  );

  const close = useCallback(() => {
    setActive(null);
    void refresh();
  }, [refresh]);

  const modal = (
    <AnimatePresence>
      {active && (
        <CaseOpener item={active} balance={user?.balance ?? 0} onClose={close} onFinished={handleFinished} />
      )}
    </AnimatePresence>
  );

  return { open, modal };
}
