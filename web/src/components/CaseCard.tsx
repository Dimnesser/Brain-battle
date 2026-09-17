import { motion } from 'framer-motion';
import clsx from 'clsx';
import { formatCoins, type CaseDto } from '@nexus/shared';
import { Countdown } from './Countdown';
import { Button } from './ui';
import type { ReactElement } from 'react';

/** Акцентные градиенты кейсов — задаются полем accent в базе. */
const ACCENTS: Record<string, string> = {
  violet: 'from-violet-500/28 via-violet-500/5',
  cyan: 'from-cyan-400/28 via-cyan-400/5',
  fuchsia: 'from-fuchsia-500/28 via-fuchsia-500/5',
  indigo: 'from-indigo-500/28 via-indigo-500/5',
  amber: 'from-amber-400/25 via-amber-400/5',
  rose: 'from-rose-500/28 via-rose-500/5',
  emerald: 'from-emerald-400/28 via-emerald-400/5',
};

export function CaseCard({
  item,
  onOpen,
  compact = false,
  delay = 0,
}: {
  item: CaseDto;
  onOpen: (item: CaseDto) => void;
  compact?: boolean;
  delay?: number;
}): ReactElement {
  const accent = ACCENTS[item.accent] ?? ACCENTS.violet;
  const locked = item.isFree && (item.availableInSeconds ?? 0) > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      onClick={() => !locked && onOpen(item)}
      className={clsx(
        'neon-border glass relative overflow-hidden p-4',
        compact ? 'w-[172px] flex-shrink-0' : 'w-full',
        locked ? 'opacity-75' : 'cursor-pointer',
      )}
    >
      {/* Световое пятно за иконкой кейса */}
      <div className={clsx('pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent', accent)} />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="animate-float text-[42px] leading-none drop-shadow-[0_6px_20px_rgba(139,92,246,0.55)]">
            {item.image}
          </div>
          {item.isFree ? (
            <span className="rounded-full bg-success/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
              Free
            </span>
          ) : (
            <span className="rounded-full bg-white/[0.07] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {item.rewardCount} наград
            </span>
          )}
        </div>

        <h3 className="mt-3 font-display text-[15px] font-bold uppercase tracking-wide text-text">{item.name}</h3>

        <p className="mt-1 text-[12px] text-text-muted">
          до <span className="font-semibold text-secondary">{formatCoins(item.maxReward)} B</span>
        </p>

        <div className="mt-4">
          {locked ? (
            <div className="flex h-11 items-center justify-center rounded-2xl border border-line/70 bg-white/[0.03] text-[13px] font-semibold text-text-muted">
              <Countdown seconds={item.availableInSeconds ?? 0} />
            </div>
          ) : (
            <Button
              fullWidth
              size="md"
              variant={item.isFree ? 'success' : 'primary'}
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
            >
              {item.isFree ? 'Открыть' : `${formatCoins(item.price)} B`}
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
