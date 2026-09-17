import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  RARITY_SHORT,
  formatCoins,
  type CaseDetailDto,
  type CaseRewardDto,
  type OpenCaseResult,
} from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { hapticNotify, haptic } from '../lib/telegram';
import { useToast } from '../store/toast';
import { Button, RarityBadge, Spinner, rarityClass, rarityGlow } from './ui';
import type { ReactElement } from 'react';

const ITEM_WIDTH = 108;
const ITEM_GAP = 12;
const STRIDE = ITEM_WIDTH + ITEM_GAP;
const SPIN_DURATION = 4.4;

type Phase = 'idle' | 'spinning' | 'result';

interface Props {
  item: CaseDetailDto;
  onClose: () => void;
  onFinished: (result: OpenCaseResult) => void;
  balance: number;
}

/**
 * Модальное окно открытия кейса.
 *
 * Лента и позиция выигрыша приходят с сервера — анимация лишь показывает
 * уже зафиксированный результат. Подменить его на клиенте невозможно.
 */
export function CaseOpener({ item, onClose, onFinished, balance }: Props): ReactElement {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<OpenCaseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const notEnough = !item.isFree && balance < item.price;
  const locked = item.isFree && (item.availableInSeconds ?? 0) > 0;

  useLayoutEffect(() => {
    const measure = (): void => setViewportWidth(trackRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Пока не крутили — показываем превью наград кейса
  const previewItems: CaseRewardDto[] = item.rewards.slice(0, 12);
  const strip = result?.roll.items ?? [...previewItems, ...previewItems, ...previewItems].slice(0, 24);

  const spin = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);

    try {
      const response = await api.cases.open(item.slug);
      setResult(response);
      setPhase('spinning');
      haptic('medium');

      // Центрируем выигрышную карточку с небольшим случайным смещением,
      // чтобы остановка не выглядела «по линейке»
      const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.35);
      const target = response.roll.winnerIndex * STRIDE - viewportWidth / 2 + ITEM_WIDTH / 2 + jitter;
      setOffset(-target);
    } catch (error) {
      const message = error instanceof ApiError ? error.humanMessage : 'Не удалось открыть кейс';
      toast.error(message);
      hapticNotify('error');
      setLoading(false);
    }
  };

  // Финал прокрутки: показываем награду
  useEffect(() => {
    if (phase !== 'spinning') return;

    const timer = setTimeout(
      () => {
        setPhase('result');
        setLoading(false);
        hapticNotify('success');
        if (result) onFinished(result);
      },
      SPIN_DURATION * 1000 + 180,
    );

    return () => clearTimeout(timer);
  }, [phase, result, onFinished]);

  const again = (): void => {
    setPhase('idle');
    setResult(null);
    setOffset(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={phase === 'spinning' ? undefined : onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
        className="glass relative w-full max-w-[520px] rounded-b-none rounded-t-[28px] p-5 pb-[calc(var(--safe-bottom)+20px)] sm:rounded-[28px] sm:pb-6"
      >
        {phase !== 'spinning' && (
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="press absolute right-4 top-4 rounded-full bg-white/[0.07] p-2 text-text-muted"
          >
            <X size={18} />
          </button>
        )}

        <div className="text-center">
          <div className="text-[44px] leading-none">{item.image}</div>
          <h2 className="mt-2 font-display text-lg font-bold uppercase tracking-wide">{item.name}</h2>
          <p className="mt-1 text-[13px] text-text-muted">
            {item.isFree ? 'Бесплатный кейс' : `Стоимость: ${formatCoins(item.price)} B`}
          </p>
        </div>

        {/* Барабан */}
        <div
          ref={trackRef}
          className="relative mt-5 overflow-hidden rounded-3xl border border-white/5 bg-black/35 py-4"
        >
          {/* Указатель выигрышной позиции */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-secondary to-transparent shadow-glow-cyan" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-bg to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-bg to-transparent" />

          <motion.div
            className="flex will-change-transform"
            style={{ gap: ITEM_GAP }}
            animate={{ x: offset }}
            transition={
              phase === 'spinning'
                ? { duration: SPIN_DURATION, ease: [0.12, 0.72, 0.12, 1] }
                : { duration: 0.3 }
            }
          >
            {strip.map((reward, index) => (
              <RollItem
                key={`${reward.id}-${index}`}
                reward={reward}
                highlighted={phase === 'result' && index === result?.roll.winnerIndex}
              />
            ))}
          </motion.div>
        </div>

        {/* Действия / результат */}
        <div className="mt-5">
          <AnimatePresence mode="wait">
            {phase === 'result' && result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-secondary">
                  🎉 Поздравляем!
                </p>
                <p className="mt-1 text-[13px] text-text-muted">Ты получил</p>
                <p className="mt-1 text-[40px] leading-none">{result.reward.image}</p>
                <p className="mt-1 font-display text-lg font-bold">{result.reward.name}</p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <p className="font-display text-3xl font-extrabold text-gradient">
                    {formatCoins(result.reward.amount)} B
                  </p>
                  <RarityBadge rarity={result.reward.rarity} />
                </div>

                {result.opening.profit > 0 && (
                  <p className="mt-1 text-[13px] font-semibold text-success">
                    Прибыль +{formatCoins(result.opening.profit)} B
                  </p>
                )}
                {result.levelUp && (
                  <p className="mt-2 text-[13px] font-semibold text-warning">
                    ⬆️ Новый уровень: {result.level}
                  </p>
                )}

                <div className="mt-4 flex gap-3">
                  <Button variant="ghost" fullWidth onClick={onClose}>
                    Забрать
                  </Button>
                  <Button fullWidth onClick={again} disabled={item.isFree}>
                    Открыть ещё
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {notEnough ? (
                  <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-center text-[13px] text-danger">
                    Недостаточно средств — пополни баланс
                  </div>
                ) : locked ? (
                  <div className="rounded-2xl border border-line/70 bg-white/[0.03] p-3 text-center text-[13px] text-text-muted">
                    Бесплатный кейс ещё восстанавливается
                  </div>
                ) : (
                  <Button fullWidth size="lg" onClick={spin} disabled={loading || phase === 'spinning'}>
                    {phase === 'spinning' ? <Spinner /> : item.isFree ? 'Открыть бесплатно' : 'Открыть'}
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Список возможных наград и шансов */}
        {phase === 'idle' && (
          <div className="mt-5">
            <p className="tile-title mb-2">Возможные награды</p>
            <div className="max-h-[168px] space-y-1.5 overflow-y-auto pr-1">
              {item.rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center gap-2.5 rounded-xl bg-white/[0.035] px-3 py-2"
                >
                  <span className="text-[17px] leading-none">{reward.image}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{reward.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[12px] font-bold tabular-nums text-secondary">
                        {formatCoins(reward.amount)} B
                      </span>
                      <RarityBadge rarity={reward.rarity} />
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-[12px] tabular-nums text-text-muted">{reward.chance}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function RollItem({ reward, highlighted }: { reward: CaseRewardDto; highlighted: boolean }): ReactElement {
  return (
    <div
      style={{ width: ITEM_WIDTH }}
      className={`flex h-[128px] flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border bg-surface-light/60 px-1 transition-all duration-300 ${
        highlighted ? `scale-105 ${rarityGlow(reward.rarity)}` : 'border-white/5'
      }`}
    >
      <span className="text-[28px] leading-none">{reward.image}</span>
      <span className="mt-1 line-clamp-2 px-1.5 text-center text-[10px] font-semibold leading-tight text-text">
        {reward.name}
      </span>
      <span className="mt-0.5 font-display text-[12px] font-bold tabular-nums text-secondary">
        {formatCoins(reward.amount)}
      </span>
      <span className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${rarityClass(reward.rarity)}`}>
        {RARITY_SHORT[reward.rarity] ?? reward.rarity}
      </span>
    </div>
  );
}
