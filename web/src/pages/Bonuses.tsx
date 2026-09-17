import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { STREAK_TARGET, formatCoins, type BonusCardDto, type BonusType } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import { Countdown } from '../components/Countdown';
import { Button, Card, ProgressBar, SectionTitle, Skeleton, StepProgress } from '../components/ui';
import { hapticNotify } from '../lib/telegram';
import type { ReactElement } from 'react';

export function BonusesPage(): ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { patchUser } = useAuth();

  const { data, isLoading } = useQuery({ queryKey: ['bonus'], queryFn: () => api.bonus.overview() });

  const claim = useMutation({
    mutationFn: (type: BonusType) => api.bonus.claim(type),
    onSuccess: (result) => {
      patchUser({ balance: result.balance, xp: result.xp, level: result.level });
      toast.success(`${result.message}: +${formatCoins(result.amount)} B`);
      hapticNotify('success');
      void queryClient.invalidateQueries({ queryKey: ['bonus'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось получить бонус');
      hapticNotify('error');
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[104px]" />
        ))}
      </div>
    );
  }

  const handleClaim = (bonus: BonusCardDto): void => {
    // Бесплатный кейс открывается в своём разделе, а не как обычный бонус
    if (bonus.type === 'FREE_CASE') {
      navigate('/cases');
      return;
    }
    claim.mutate(bonus.type);
  };

  return (
    <div className="space-y-5">
      <div className="px-1">
        <h1 className="font-display text-2xl font-extrabold">Бонусы</h1>
        <p className="text-[13px] text-text-muted">Забирай награды каждый день</p>
      </div>

      {/* Серия входов */}
      <Card glow>
        <div className="flex items-center justify-between">
          <div>
            <p className="tile-title">🔥 Серия входов</p>
            <p className="mt-1 font-display text-lg font-bold">
              День {data.streak.current} из {STREAK_TARGET}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-text-muted">Следующая награда</p>
            <p className="font-display text-lg font-bold text-secondary">
              +{formatCoins(data.streak.nextReward)} B
            </p>
          </div>
        </div>
        <div className="mt-3">
          <StepProgress current={data.streak.current} target={STREAK_TARGET} />
        </div>
      </Card>

      {/* Акция дня */}
      <Card className="border-primary/20">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💎</span>
          <div className="flex-1">
            <p className="tile-title">Акция дня</p>
            <p className="font-display text-base font-bold text-gradient">{data.dailyOffer.title}</p>
          </div>
          <Countdown
            seconds={data.dailyOffer.endsInSeconds}
            className="font-display text-[13px] font-bold tabular-nums text-text-muted"
          />
        </div>
      </Card>

      <section>
        <SectionTitle title="Доступные бонусы" />
        <div className="space-y-3">
          {data.bonuses.map((bonus, index) => (
            <Card key={bonus.type} delay={index * 0.05}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold">{bonus.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">{bonus.description}</p>

                  {bonus.progress && (
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar
                        percent={(bonus.progress.current / Math.max(bonus.progress.target, 1)) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-[11px] tabular-nums text-text-muted">
                        {bonus.progress.current}/{bonus.progress.target}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {bonus.amount > 0 && (
                    <span className="font-display text-[15px] font-bold text-secondary">
                      +{formatCoins(bonus.amount)} B
                    </span>
                  )}

                  {bonus.available ? (
                    <Button
                      size="sm"
                      variant={bonus.type === 'FREE_CASE' ? 'success' : 'primary'}
                      loading={claim.isPending && claim.variables === bonus.type}
                      onClick={() => handleClaim(bonus)}
                    >
                      {bonus.type === 'FREE_CASE' ? 'Открыть' : 'Получить'}
                    </Button>
                  ) : bonus.availableInSeconds > 0 ? (
                    <span className="rounded-xl bg-white/[0.05] px-3 py-2 text-[12px] font-semibold tabular-nums text-text-muted">
                      <Countdown seconds={bonus.availableInSeconds} />
                    </span>
                  ) : (
                    <span className="rounded-xl bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-text-muted">
                      {bonus.claimed ? 'Получено' : 'Недоступно'}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
