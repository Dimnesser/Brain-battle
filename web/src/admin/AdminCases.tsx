import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Power, Save } from 'lucide-react';
import { formatCoins } from '@nexus/shared';
import { ApiError, api, type AdminCase, type AdminReward } from '../lib/api';
import { useToast } from '../store/toast';
import { Button, Card, Skeleton } from '../components/ui';
import type { ReactElement } from 'react';

const EMPTY_REWARD: AdminReward = { name: '', amount: 0, image: '💎', rarity: 'COMMON', probability: 10 };

const CATEGORIES = ['POPULAR', 'PREMIUM', 'REGULAR', 'FREE'] as const;
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const;

export function AdminCases(): ReactElement {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminCase | 'new' | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'cases'], queryFn: () => api.admin.cases() });

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'cases'] });
    void queryClient.invalidateQueries({ queryKey: ['cases'] });
  };

  const toggle = useMutation({
    mutationFn: (item: AdminCase) =>
      item.isActive ? api.admin.disableCase(item.id) : api.admin.updateCase(item.id, { isActive: true }),
    onSuccess: () => {
      toast.success('Статус кейса обновлён');
      refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Ошибка обновления'),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[120px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button fullWidth icon={<Plus size={16} />} onClick={() => setEditing('new')}>
        Создать кейс
      </Button>

      <div className="space-y-3">
        {data?.items.map((item) => {
          const totalWeight = item.rewards.reduce((sum, reward) => sum + reward.probability, 0);
          const expected =
            totalWeight > 0
              ? item.rewards.reduce((sum, reward) => sum + (reward.probability / totalWeight) * reward.amount, 0)
              : 0;
          const rtp = item.price > 0 ? (expected / item.price) * 100 : 0;

          return (
            <Card key={item.id} className="p-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{item.image}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] font-bold">
                    {item.name}
                    {!item.isActive && <span className="ml-2 text-[11px] text-danger">выключен</span>}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {item.slug} · {item.category} · {item.rewards.length} наград · открыт {item.opened} раз
                  </p>
                  <p className="mt-1 text-[12px]">
                    <span className="font-semibold">{formatCoins(item.price)} B</span>
                    {item.price > 0 && (
                      <span className={rtp > 100 ? 'ml-2 text-danger' : 'ml-2 text-success'}>
                        RTP {rtp.toFixed(1)}%
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant={item.isActive ? 'danger' : 'outline'}
                    icon={<Power size={13} />}
                    loading={toggle.isPending && toggle.variables?.id === item.id}
                    onClick={() => toggle.mutate(item)}
                  >
                    {item.isActive ? 'Выкл' : 'Вкл'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <CaseEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CaseEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminCase | null;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const toast = useToast();
  const [form, setForm] = useState({
    slug: initial?.slug ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    image: initial?.image ?? '⚡',
    accent: initial?.accent ?? 'violet',
    price: initial?.price ?? 100,
    category: initial?.category ?? 'REGULAR',
    isActive: initial?.isActive ?? true,
    sortOrder: initial?.sortOrder ?? 0,
    cooldownSeconds: initial?.cooldownSeconds ?? null,
  });
  const [rewards, setRewards] = useState<AdminReward[]>(initial?.rewards ?? [{ ...EMPTY_REWARD }]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        description: form.description || undefined,
        rewards: rewards.map(({ id: _id, ...reward }) => reward),
      };
      return initial ? api.admin.updateCase(initial.id, payload) : api.admin.createCase(payload);
    },
    onSuccess: () => {
      toast.success(initial ? 'Кейс обновлён' : 'Кейс создан');
      onSaved();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось сохранить кейс'),
  });

  const totalWeight = rewards.reduce((sum, reward) => sum + Number(reward.probability || 0), 0);
  const expected =
    totalWeight > 0
      ? rewards.reduce((sum, reward) => sum + (Number(reward.probability) / totalWeight) * Number(reward.amount), 0)
      : 0;
  const rtp = form.price > 0 ? (expected / form.price) * 100 : 0;

  const patchReward = (index: number, patch: Partial<AdminReward>): void => {
    setRewards((current) => current.map((reward, i) => (i === index ? { ...reward, ...patch } : reward)));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4" onClick={onClose}>
      <div
        className="glass mx-auto my-6 w-full max-w-[560px] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="font-display text-base font-bold">{initial ? 'Редактирование кейса' : 'Новый кейс'}</h3>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Field label="Название">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="input-field"
            />
          </Field>
          <Field label="Slug (латиница)">
            <input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })}
              className="input-field"
              disabled={Boolean(initial)}
            />
          </Field>
          <Field label="Иконка">
            <input
              value={form.image}
              onChange={(event) => setForm({ ...form, image: event.target.value })}
              className="input-field"
            />
          </Field>
          <Field label="Цена, B">
            <input
              value={form.price}
              onChange={(event) => setForm({ ...form, price: Number(event.target.value.replace(/\D/g, '')) })}
              inputMode="numeric"
              className="input-field"
            />
          </Field>
          <Field label="Категория">
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              className="input-field"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category} className="bg-surface">
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Акцент">
            <select
              value={form.accent}
              onChange={(event) => setForm({ ...form, accent: event.target.value })}
              className="input-field"
            >
              {['violet', 'cyan', 'fuchsia', 'indigo', 'amber', 'rose', 'emerald'].map((accent) => (
                <option key={accent} value={accent} className="bg-surface">
                  {accent}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Описание" className="mt-2">
          <input
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className="input-field"
          />
        </Field>

        {form.price === 0 && (
          <Field label="Кулдаун, секунд (для бесплатного кейса)" className="mt-2">
            <input
              value={form.cooldownSeconds ?? ''}
              onChange={(event) =>
                setForm({ ...form, cooldownSeconds: Number(event.target.value.replace(/\D/g, '')) || null })
              }
              inputMode="numeric"
              placeholder="86400"
              className="input-field"
            />
          </Field>
        )}

        <div className="mt-5 flex items-center justify-between">
          <p className="tile-title">Награды и вероятности</p>
          <span className={`text-[12px] font-semibold ${rtp > 100 ? 'text-danger' : 'text-success'}`}>
            RTP {form.price > 0 ? `${rtp.toFixed(1)}%` : '—'}
          </span>
        </div>

        <div className="mt-2 space-y-2">
          {rewards.map((reward, index) => (
            <div key={index} className="grid grid-cols-12 gap-1.5">
              <input
                value={reward.image}
                onChange={(event) => patchReward(index, { image: event.target.value })}
                className="input-field col-span-2 px-2 py-2 text-center"
              />
              <input
                value={reward.name}
                onChange={(event) => patchReward(index, { name: event.target.value })}
                placeholder="Название"
                className="input-field col-span-3 px-2 py-2"
              />
              <input
                value={reward.amount}
                onChange={(event) => patchReward(index, { amount: Number(event.target.value.replace(/\D/g, '')) })}
                inputMode="numeric"
                placeholder="B"
                className="input-field col-span-2 px-2 py-2"
              />
              <select
                value={reward.rarity}
                onChange={(event) => patchReward(index, { rarity: event.target.value })}
                className="input-field col-span-3 px-1 py-2 text-[12px]"
              >
                {RARITIES.map((rarity) => (
                  <option key={rarity} value={rarity} className="bg-surface">
                    {rarity}
                  </option>
                ))}
              </select>
              <input
                value={reward.probability}
                onChange={(event) => patchReward(index, { probability: Number(event.target.value) || 0 })}
                inputMode="decimal"
                placeholder="%"
                className="input-field col-span-2 px-2 py-2"
              />
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
          <button
            onClick={() => setRewards([...rewards, { ...EMPTY_REWARD }])}
            className="press font-semibold text-secondary"
          >
            + добавить награду
          </button>
          {rewards.length > 1 && (
            <button
              onClick={() => setRewards(rewards.slice(0, -1))}
              className="press font-semibold text-danger"
            >
              удалить последнюю
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-text-muted">
          Сумма весов: {totalWeight.toFixed(2)} — веса нормализуются автоматически
        </p>

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Отмена
          </Button>
          <Button
            fullWidth
            icon={<Save size={15} />}
            loading={save.isPending}
            disabled={!form.name || !form.slug || rewards.some((reward) => !reward.name)}
            onClick={() => save.mutate()}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactElement;
  className?: string;
}): ReactElement {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      {children}
    </label>
  );
}
