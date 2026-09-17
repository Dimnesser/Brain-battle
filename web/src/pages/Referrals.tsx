import { useQuery } from '@tanstack/react-query';
import { Copy, Share2 } from 'lucide-react';
import { formatCoins } from '@nexus/shared';
import { api } from '../lib/api';
import { shareLink } from '../lib/telegram';
import { useToast } from '../store/toast';
import { Avatar, Button, Card, EmptyState, SectionTitle, Skeleton, StatTile } from '../components/ui';
import { PageHeader } from './Deposit';
import type { ReactElement } from 'react';

export function ReferralsPage(): ReactElement {
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['referrals'], queryFn: () => api.referrals() });

  const copy = async (): Promise<void> => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success('Ссылка скопирована');
    } catch {
      // clipboard недоступен в некоторых WebView — показываем ссылку как есть
      toast.error('Скопируйте ссылку вручную');
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Рефералы" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Рефералы" subtitle="Приглашай друзей и зарабатывай" />

      <Card glow className="text-center">
        <div className="text-5xl">👥</div>
        <p className="mt-2 text-[13px] text-text-muted">
          За каждого друга: <span className="font-semibold text-success">+{formatCoins(data.referrerBonus)} B</span>
          {' · '}другу: <span className="font-semibold text-secondary">+{formatCoins(data.refereeBonus)} B</span>
        </p>
        <p className="mt-1 text-[12px] text-text-muted">Плюс 10% с каждого его пополнения</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatTile label="Приглашено" value={data.invited} />
          <StatTile label="Заработано" value={`${formatCoins(data.earned)} B`} tone="success" />
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-3">
          <span className="min-w-0 flex-1 truncate text-left text-[12px] text-text-muted">{data.link}</span>
          <button onClick={copy} aria-label="Копировать" className="press rounded-xl bg-white/[0.07] p-2">
            <Copy size={15} />
          </button>
        </div>

        <Button
          fullWidth
          size="lg"
          className="mt-3"
          icon={<Share2 size={17} />}
          onClick={() => shareLink(data.link, data.shareText)}
        >
          Пригласить друзей
        </Button>
      </Card>

      <section>
        <SectionTitle title="Мои рефералы" />
        {data.list.length === 0 ? (
          <EmptyState icon="🙌" title="Пока никого" hint="Поделись ссылкой — бонус придёт сразу после регистрации друга" />
        ) : (
          <div className="space-y-2">
            {data.list.map((referral) => (
              <div key={referral.id} className="glass-soft flex items-center gap-3 px-3 py-2.5">
                <Avatar src={referral.avatar} name={referral.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{referral.name}</p>
                  <p className="text-[11px] text-text-muted">
                    Ур. {referral.level} · {new Date(referral.joinedAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <span className="font-display text-[13px] font-bold tabular-nums text-success">
                  +{formatCoins(referral.earned)} B
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
