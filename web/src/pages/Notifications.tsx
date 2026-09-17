import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { EmptyState, Skeleton } from '../components/ui';
import { PageHeader } from './Deposit';
import type { ReactElement } from 'react';

export function NotificationsPage(): ReactElement {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => api.user.notifications() });

  const markRead = useMutation({
    mutationFn: () => api.user.readNotifications(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Открытие экрана само по себе означает прочтение
  useEffect(() => {
    if (data?.items.some((item) => !item.isRead)) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.items.length]);

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Уведомления" />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[72px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="🔔" title="Пока пусто" hint="Здесь появятся новости о бонусах, выплатах и выигрышах" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`glass-soft px-4 py-3 ${item.isRead ? 'opacity-70' : 'ring-1 ring-primary/25'}`}
            >
              <p className="text-[14px] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">{item.body}</p>
              <p className="mt-1 text-[11px] text-text-muted/70">
                {new Date(item.createdAt).toLocaleString('ru-RU')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
