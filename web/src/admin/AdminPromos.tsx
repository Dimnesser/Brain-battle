import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatCoins } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { useToast } from '../store/toast';
import { Button, Card, EmptyState, Skeleton } from '../components/ui';
import type { ReactElement } from 'react';

const TYPES = [
  { id: 'BALANCE', label: 'Монеты' },
  { id: 'DEPOSIT_PERCENT', label: '% к пополнению' },
  { id: 'XP', label: 'Опыт' },
] as const;

export function AdminPromos(): ReactElement {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'BALANCE', amount: 100, maxActivations: '', perUserLimit: 1 });

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'promos'], queryFn: () => api.admin.promos() });

  const refresh = (): void => void queryClient.invalidateQueries({ queryKey: ['admin', 'promos'] });

  const create = useMutation({
    mutationFn: () =>
      api.admin.createPromo({
        code: form.code.trim().toUpperCase(),
        type: form.type,
        amount: Number(form.amount),
        maxActivations: form.maxActivations ? Number(form.maxActivations) : null,
        perUserLimit: Number(form.perUserLimit),
      }),
    onSuccess: () => {
      toast.success('Промокод создан');
      setOpen(false);
      setForm({ code: '', type: 'BALANCE', amount: 100, maxActivations: '', perUserLimit: 1 });
      refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось создать промокод'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.admin.togglePromo(id, isActive),
    onSuccess: () => {
      toast.success('Промокод обновлён');
      refresh();
    },
  });

  return (
    <div className="space-y-4">
      <Button fullWidth icon={<Plus size={16} />} onClick={() => setOpen((value) => !value)}>
        {open ? 'Скрыть форму' : 'Создать промокод'}
      </Button>

      {open && (
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              placeholder="КОД"
              className="input-field col-span-2 font-display tracking-widest"
            />
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
              className="input-field"
            >
              {TYPES.map((type) => (
                <option key={type.id} value={type.id} className="bg-surface">
                  {type.label}
                </option>
              ))}
            </select>
            <input
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: Number(event.target.value.replace(/\D/g, '')) })}
              inputMode="numeric"
              placeholder="Размер"
              className="input-field"
            />
            <input
              value={form.maxActivations}
              onChange={(event) => setForm({ ...form, maxActivations: event.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
              placeholder="Лимит активаций (пусто = ∞)"
              className="input-field"
            />
            <input
              value={form.perUserLimit}
              onChange={(event) =>
                setForm({ ...form, perUserLimit: Number(event.target.value.replace(/\D/g, '')) || 1 })
              }
              inputMode="numeric"
              placeholder="На одного игрока"
              className="input-field"
            />
          </div>
          <Button
            fullWidth
            className="mt-3"
            loading={create.isPending}
            disabled={form.code.trim().length < 3 || form.amount <= 0}
            onClick={() => create.mutate()}
          >
            Создать
          </Button>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[76px]" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon="🎟" title="Промокодов нет" hint="Создайте первый промокод" />
      ) : (
        <div className="space-y-2">
          {data?.items.map((promo) => (
            <Card key={promo.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold tracking-wider">
                    {promo.code}
                    {!promo.isActive && <span className="ml-2 text-[11px] text-danger">выключен</span>}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {TYPES.find((type) => type.id === promo.type)?.label ?? promo.type} ·{' '}
                    {promo.type === 'DEPOSIT_PERCENT' ? `${promo.amount}%` : `${formatCoins(promo.amount)}`} ·{' '}
                    активаций {promo.activations}
                    {promo.maxActivations ? ` / ${promo.maxActivations}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={promo.isActive ? 'danger' : 'outline'}
                  loading={toggle.isPending && toggle.variables?.id === promo.id}
                  onClick={() => toggle.mutate({ id: promo.id, isActive: !promo.isActive })}
                >
                  {promo.isActive ? 'Выкл' : 'Вкл'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
