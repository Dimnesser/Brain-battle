import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ban, Search, ShieldCheck, Wallet } from 'lucide-react';
import { formatCoins } from '@nexus/shared';
import type { AdminUserDto } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { useToast } from '../store/toast';
import { Button, Card, EmptyState, Skeleton } from '../components/ui';
import type { ReactElement } from 'react';

export function AdminUsers(): ReactElement {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUserDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api.admin.users(search),
  });

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const adjust = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
      api.admin.adjustBalance(id, amount, reason),
    onSuccess: ({ balance }) => {
      toast.success(`Баланс обновлён: ${formatCoins(balance)} B`);
      setSelected(null);
      refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось изменить баланс'),
  });

  const ban = useMutation({
    mutationFn: ({ id, isBanned }: { id: string; isBanned: boolean }) => api.admin.ban(id, isBanned),
    onSuccess: ({ user }) => {
      toast.success(user.isBanned ? 'Игрок заблокирован' : 'Блокировка снята');
      refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось изменить статус'),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(query.trim());
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, username, Telegram ID или реф-код"
            className="input-field pl-10"
          />
        </div>
        <Button type="submit">Найти</Button>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[92px]" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon="🔍" title="Ничего не найдено" hint="Измените условия поиска" />
      ) : (
        <>
          <p className="px-1 text-[12px] text-text-muted">Найдено: {data?.total ?? 0}</p>
          <div className="space-y-2">
            {data?.items.map((user) => (
              <Card key={user.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[14px] font-semibold">
                      {user.username ? `@${user.username}` : (user.firstName ?? 'Игрок')}
                      {user.isAdmin && <ShieldCheck size={14} className="text-warning" />}
                      {user.isBanned && <Ban size={14} className="text-danger" />}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      TG {user.telegramId} · ур. {user.level} · кейсов {user.casesOpened}
                    </p>
                    <p className="mt-1 font-display text-[15px] font-bold tabular-nums">
                      {formatCoins(user.balance)} B
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="ghost" icon={<Wallet size={14} />} onClick={() => setSelected(user)}>
                      Баланс
                    </Button>
                    <Button
                      size="sm"
                      variant={user.isBanned ? 'outline' : 'danger'}
                      loading={ban.isPending && ban.variables?.id === user.id}
                      onClick={() => ban.mutate({ id: user.id, isBanned: !user.isBanned })}
                    >
                      {user.isBanned ? 'Разбан' : 'Бан'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {selected && (
        <BalanceDialog
          user={selected}
          pending={adjust.isPending}
          onClose={() => setSelected(null)}
          onSubmit={(amount, reason) => adjust.mutate({ id: selected.id, amount, reason })}
        />
      )}
    </div>
  );
}

function BalanceDialog({
  user,
  pending,
  onClose,
  onSubmit,
}: {
  user: AdminUserDto;
  pending: boolean;
  onClose: () => void;
  onSubmit: (amount: number, reason: string) => void;
}): ReactElement {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const value = Number(amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="glass w-full max-w-[380px] p-5" onClick={(event) => event.stopPropagation()}>
        <h3 className="font-display text-base font-bold">Изменить баланс</h3>
        <p className="mt-0.5 text-[12px] text-text-muted">
          {user.username ? `@${user.username}` : user.firstName} · сейчас {formatCoins(user.balance)} B
        </p>

        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d-]/g, ''))}
          inputMode="numeric"
          placeholder="Например, 500 или -200"
          className="input-field mt-4"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Причина (попадёт в историю игрока)"
          className="input-field mt-2"
        />

        <div className="mt-4 flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Отмена
          </Button>
          <Button
            fullWidth
            loading={pending}
            disabled={!Number.isInteger(value) || value === 0}
            onClick={() => onSubmit(value, reason)}
          >
            Применить
          </Button>
        </div>
      </div>
    </div>
  );
}
