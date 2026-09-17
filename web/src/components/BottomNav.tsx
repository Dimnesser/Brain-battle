import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, Home, Target, Trophy, User } from 'lucide-react';
import clsx from 'clsx';
import { haptic } from '../lib/telegram';
import type { ReactElement } from 'react';

const ITEMS = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/cases', label: 'Кейсы', icon: Gift },
  { to: '/bonuses', label: 'Бонусы', icon: Target },
  { to: '/leaderboard', label: 'Рейтинг', icon: Trophy },
  { to: '/profile', label: 'Профиль', icon: User },
] as const;

export function BottomNav(): ReactElement {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[var(--safe-bottom)]">
      <div className="mx-auto max-w-[520px] px-3 pb-3">
        <div className="glass flex items-stretch justify-between gap-1 rounded-3xl px-2 py-2">
          {ITEMS.map((item) => {
            const active =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => haptic('light')}
                className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2"
              >
                {active && (
                  // Общий layoutId даёт плавный перелёт подсветки между вкладками
                  <motion.span
                    layoutId="nav-active"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/25 to-secondary/10 ring-1 ring-primary/25"
                  />
                )}
                <Icon
                  size={20}
                  className={clsx('relative transition-colors', active ? 'text-primary-soft' : 'text-text-muted')}
                />
                <span
                  className={clsx(
                    'relative text-[10px] font-semibold transition-colors',
                    active ? 'text-text' : 'text-text-muted',
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
