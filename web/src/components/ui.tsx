import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { RARITY_LABELS } from '@nexus/shared';
import { haptic } from '../lib/telegram';
import type { ReactElement } from 'react';

/* ── Кнопка ───────────────────────────────── */

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-primary to-secondary text-white shadow-glow-sm',
  ghost: 'bg-white/[0.06] text-text border border-white/5',
  outline: 'border border-primary/45 text-primary-soft bg-primary/5',
  success: 'bg-gradient-to-r from-success to-secondary text-[#04231a] font-bold',
  danger: 'bg-danger/15 text-danger border border-danger/35',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl',
  md: 'h-12 px-5 text-[15px] rounded-2xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  className,
  children,
  disabled,
  onClick,
  ...props
}: ButtonProps): ReactElement {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      onClick={(event) => {
        haptic('light');
        onClick?.(event);
      }}
      className={clsx(
        'press inline-flex items-center justify-center gap-2 font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }): ReactElement {
  return (
    <span
      className={clsx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white',
        className,
      )}
    />
  );
}

/* ── Карточки и заголовки ─────────────────── */

export function Card({
  children,
  className,
  glow = false,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  delay?: number;
}): ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('glass p-4', glow && 'neon-border shadow-glow', className)}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({
  title,
  action,
  icon,
}: {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
}): ReactElement {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-bold uppercase tracking-[0.12em] text-text">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'primary' | 'danger';
}): ReactElement {
  const tones = {
    default: 'text-text',
    success: 'text-success',
    primary: 'text-primary-soft',
    danger: 'text-danger',
  };

  return (
    <div className="glass-soft p-3.5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className={clsx('mt-1 font-display text-xl font-bold tabular-nums', tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

/* ── Прогресс ─────────────────────────────── */

export function ProgressBar({
  percent,
  className,
  tone = 'primary',
}: {
  percent: number;
  className?: string;
  tone?: 'primary' | 'success' | 'warning';
}): ReactElement {
  const tones = {
    primary: 'from-primary to-secondary',
    success: 'from-success to-secondary',
    warning: 'from-warning to-danger',
  };

  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={clsx('h-full rounded-full bg-gradient-to-r', tones[tone])}
      />
    </div>
  );
}

/** Прогресс сериями точек — для серии входов. */
export function StepProgress({ current, target }: { current: number; target: number }): ReactElement {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: target }).map((_, index) => (
        <div
          key={index}
          className={clsx(
            'h-2 flex-1 rounded-full transition-colors',
            index < current ? 'bg-gradient-to-r from-primary to-secondary' : 'bg-white/[0.08]',
          )}
        />
      ))}
    </div>
  );
}

/* ── Вспомогательные ──────────────────────── */

export function Avatar({
  src,
  name,
  size = 44,
  ring = false,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}): ReactElement {
  const letter = (name ?? 'N').replace('@', '').charAt(0).toUpperCase();

  return (
    <div
      style={{ width: size, height: size }}
      className={clsx(
        'relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-primary/35 to-secondary/25 font-display font-bold text-text',
        ring && 'ring-2 ring-primary/50',
      )}
    >
      {src ? (
        <img src={src} alt={name ?? 'avatar'} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span style={{ fontSize: size * 0.4 }}>{letter}</span>
      )}
    </div>
  );
}

export function RarityBadge({ rarity }: { rarity: string }): ReactElement {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', rarityClass(rarity))}>
      {RARITY_LABELS[rarity] ?? rarity}
    </span>
  );
}

export function rarityClass(rarity: string): string {
  switch (rarity) {
    case 'MYTHIC':
      return 'bg-rose-500/15 text-rose-300';
    case 'LEGENDARY':
      return 'bg-amber-400/15 text-amber-300';
    case 'EPIC':
      return 'bg-fuchsia-500/15 text-fuchsia-300';
    case 'RARE':
      return 'bg-cyan-400/15 text-cyan-300';
    default:
      return 'bg-white/[0.07] text-text-muted';
  }
}

export function rarityGlow(rarity: string): string {
  switch (rarity) {
    case 'MYTHIC':
      return 'shadow-[0_0_34px_-8px_rgba(244,63,94,0.75)] border-rose-400/45';
    case 'LEGENDARY':
      return 'shadow-[0_0_34px_-8px_rgba(251,191,36,0.7)] border-amber-300/45';
    case 'EPIC':
      return 'shadow-[0_0_30px_-10px_rgba(217,70,239,0.7)] border-fuchsia-400/40';
    case 'RARE':
      return 'shadow-[0_0_28px_-10px_rgba(34,211,238,0.65)] border-cyan-300/40';
    default:
      return 'border-white/10';
  }
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }): ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 text-4xl opacity-70">{icon}</div>
      <p className="font-display text-base font-semibold text-text">{title}</p>
      {hint && <p className="max-w-[260px] text-[13px] text-text-muted">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }): ReactElement {
  return <div className={clsx('skeleton', className)} />;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}): ReactElement {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            haptic('light');
            onChange(tab.id);
          }}
          className={clsx('chip', value === tab.id && 'chip-active')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
