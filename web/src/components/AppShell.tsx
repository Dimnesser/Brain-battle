import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Plus, ShieldCheck } from 'lucide-react';
import { APP_TAGLINE, displayName } from '@nexus/shared';
import { useAuth } from '../store/auth';
import { AnimatedBalance } from './Balance';
import { Avatar, ProgressBar } from './ui';
import { BottomNav } from './BottomNav';
import type { ReactElement } from 'react';

export function AppShell(): ReactElement {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <></>;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col">
      <header className="safe-top sticky top-0 z-30 bg-bg/80 px-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="press flex items-center gap-3">
            <Avatar src={user.avatar} name={displayName(user)} size={44} ring />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight">{displayName(user)}</p>
              <p className="text-[11px] text-text-muted">
                Ур. {user.level} · {user.levelTitle}
              </p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {user.isAdmin && (
              <Link
                to="/admin"
                aria-label="Админ-панель"
                className="press rounded-2xl bg-white/[0.06] p-2.5 text-warning"
              >
                <ShieldCheck size={18} />
              </Link>
            )}
            <Link
              to="/notifications"
              aria-label="Уведомления"
              className="press rounded-2xl bg-white/[0.06] p-2.5 text-text-muted"
            >
              <Bell size={18} />
            </Link>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="neon-border glass flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
            <span className="text-xl">💰</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Баланс</p>
              <p className="font-display text-xl font-extrabold leading-tight">
                <AnimatedBalance value={user.balance} /> <span className="text-sm text-text-muted">B</span>
              </p>
            </div>
            <Link
              to="/deposit"
              className="press flex items-center gap-1 rounded-xl bg-gradient-to-r from-primary to-secondary px-3 py-2 text-[13px] font-bold text-white shadow-glow-sm"
            >
              <Plus size={15} />
              Пополнить
            </Link>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 px-1">
          <ProgressBar percent={user.progress.percent} className="h-1.5 flex-1" />
          <span className="text-[10px] tabular-nums text-text-muted">
            {user.progress.isMax ? 'MAX' : `${user.progress.xpIntoLevel}/${user.progress.xpForNextLevel} XP`}
          </span>
        </div>
      </header>

      <main className="safe-bottom flex-1 px-4 pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>

        <p className="pb-4 pt-8 text-center text-[10px] uppercase tracking-[0.3em] text-text-muted/50">
          {APP_TAGLINE}
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
