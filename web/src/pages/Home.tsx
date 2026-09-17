import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Flame, Gift, Sparkles, TrendingUp } from 'lucide-react';
import { formatCoins, type CaseDto } from '@nexus/shared';
import { api } from '../lib/api';
import { useWinFeed } from '../lib/realtime';
import { useCaseOpening } from '../hooks/useCaseOpening';
import { CaseCard } from '../components/CaseCard';
import { Countdown } from '../components/Countdown';
import { Avatar, Button, Card, EmptyState, SectionTitle, Skeleton, rarityClass } from '../components/ui';
import type { ReactElement } from 'react';

export function HomePage(): ReactElement {
  const { open, modal } = useCaseOpening();

  const casesQuery = useQuery({ queryKey: ['cases'], queryFn: () => api.cases.list() });
  const bonusQuery = useQuery({ queryKey: ['bonus'], queryFn: () => api.bonus.overview() });
  // Лента подтягивается один раз, дальше обновляется по WebSocket
  const winsQuery = useQuery({ queryKey: ['wins'], queryFn: () => api.wins(), refetchInterval: 60_000 });

  const { wins, online } = useWinFeed(winsQuery.data?.items ?? []);

  const cases = casesQuery.data?.items ?? [];
  const freeCase = cases.find((item) => item.isFree);
  const popular = cases.filter((item) => !item.isFree).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Бонус дня */}
      {bonusQuery.isLoading ? (
        <Skeleton className="h-[116px]" />
      ) : bonusQuery.data ? (
        <Card glow className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 text-4xl">🔥</div>
              <div className="min-w-0">
                <p className="tile-title">Бонус дня</p>
                <p className="break-words font-display text-[19px] font-extrabold leading-tight text-gradient">
                  {bonusQuery.data.dailyOffer.title}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-text-muted">
                Осталось{' '}
                <Countdown
                  seconds={bonusQuery.data.dailyOffer.endsInSeconds}
                  className="font-semibold tabular-nums text-text"
                />
              </p>
              <Link to="/deposit" className="flex-shrink-0">
                <Button size="sm">Получить</Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Бесплатный кейс */}
      {freeCase && (
        <Card className="relative overflow-hidden border-success/20">
          <div className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full bg-success/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="animate-float flex-shrink-0 text-4xl">{freeCase.image}</div>
            <div className="min-w-0 flex-1">
              <p className="tile-title">Бесплатный кейс</p>
              <p className="truncate font-display text-[17px] font-bold">{freeCase.name}</p>
              {(freeCase.availableInSeconds ?? 0) > 0 ? (
                <p className="text-[12px] text-text-muted">
                  Через{' '}
                  <Countdown
                    seconds={freeCase.availableInSeconds ?? 0}
                    className="font-semibold tabular-nums text-text"
                  />
                </p>
              ) : (
                <p className="text-[12px] text-success">Доступен прямо сейчас</p>
              )}
            </div>
            <Button
              size="sm"
              variant="success"
              className="flex-shrink-0"
              disabled={(freeCase.availableInSeconds ?? 0) > 0}
              onClick={() => open(freeCase)}
            >
              Открыть
            </Button>
          </div>
        </Card>
      )}

      {/* Популярные кейсы */}
      <section>
        <SectionTitle
          title="Популярные кейсы"
          icon={<Sparkles size={15} className="text-primary-soft" />}
          action={
            <Link to="/cases" className="text-[12px] font-semibold text-secondary">
              Все →
            </Link>
          }
        />

        {casesQuery.isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-[236px] w-[172px] flex-shrink-0" />
            ))}
          </div>
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {popular.map((item: CaseDto, index) => (
              <CaseCard key={item.id} item={item} compact onOpen={open} delay={index * 0.05} />
            ))}
          </div>
        )}
      </section>

      {/* Живая лента выигрышей */}
      <section>
        <SectionTitle
          title="Крупные выигрыши"
          icon={<TrendingUp size={15} className="text-secondary" />}
          action={
            online > 0 ? (
              <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                {online} онлайн
              </span>
            ) : undefined
          }
        />

        <div className="space-y-2">
          {winsQuery.isLoading ? (
            [0, 1, 2].map((index) => <Skeleton key={index} className="h-[62px]" />)
          ) : wins.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Flame />}
                title="Пока тихо"
                hint="Крупные выигрыши появятся здесь в реальном времени"
              />
            </Card>
          ) : (
            wins.map((win) => (
              <div
                key={win.id}
                className="glass-soft flex animate-fade-up items-center gap-3 px-3 py-2.5"
              >
                <Avatar src={win.user.avatar} name={win.user.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{win.user.name}</p>
                  <p className="truncate text-[11px] text-text-muted">
                    {win.caseImage} {win.caseName}
                  </p>
                </div>
                <span
                  className={`rounded-xl px-2.5 py-1 font-display text-[13px] font-bold tabular-nums ${rarityClass(
                    win.rarity,
                  )}`}
                >
                  +{formatCoins(win.amount)} B
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Быстрые действия */}
      <section className="grid grid-cols-2 gap-3">
        <Link to="/promo" className="glass-soft press flex items-center gap-3 p-4">
          <span className="text-2xl">🎟</span>
          <span className="text-[13px] font-semibold">Промокод</span>
        </Link>
        <Link to="/referrals" className="glass-soft press flex items-center gap-3 p-4">
          <span className="text-2xl">👥</span>
          <span className="text-[13px] font-semibold">Рефералы</span>
        </Link>
        <Link to="/bonuses" className="glass-soft press flex items-center gap-3 p-4">
          <Gift size={22} className="text-success" />
          <span className="text-[13px] font-semibold">Бонусы</span>
        </Link>
        <Link to="/history" className="glass-soft press flex items-center gap-3 p-4">
          <span className="text-2xl">📜</span>
          <span className="text-[13px] font-semibold">История</span>
        </Link>
      </section>

      {modal}
    </div>
  );
}
