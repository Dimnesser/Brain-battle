import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CATEGORY_LABELS, type CaseCategory } from '@nexus/shared';
import { api } from '../lib/api';
import { useCaseOpening } from '../hooks/useCaseOpening';
import { CaseCard } from '../components/CaseCard';
import { EmptyState, Skeleton, Tabs } from '../components/ui';
import type { ReactElement } from 'react';

type Filter = 'ALL' | CaseCategory;

const TABS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'ALL', label: '✨ Все' },
  { id: 'POPULAR', label: CATEGORY_LABELS.POPULAR! },
  { id: 'PREMIUM', label: CATEGORY_LABELS.PREMIUM! },
  { id: 'REGULAR', label: CATEGORY_LABELS.REGULAR! },
  { id: 'FREE', label: CATEGORY_LABELS.FREE! },
];

export function CasesPage(): ReactElement {
  const [filter, setFilter] = useState<Filter>('ALL');
  const { open, modal } = useCaseOpening();

  const { data, isLoading } = useQuery({
    queryKey: ['cases', filter],
    queryFn: () => api.cases.list(filter === 'ALL' ? undefined : filter),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="font-display text-2xl font-extrabold">Кейсы</h1>
        <p className="text-[13px] text-text-muted">Выбирай кейс и забирай награду</p>
      </div>

      <Tabs tabs={TABS} value={filter} onChange={setFilter} />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[236px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="📦" title="Кейсов пока нет" hint="В этой категории кейсы скоро появятся" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item, index) => (
            <CaseCard key={item.id} item={item} onOpen={open} delay={index * 0.04} />
          ))}
        </div>
      )}

      {modal}
    </div>
  );
}
