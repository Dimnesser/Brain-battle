import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';
import { useAuth } from '../store/auth';
import type { ReactElement } from 'react';

const TABS = [
  { to: '/admin', label: 'Обзор', end: true },
  { to: '/admin/users', label: 'Игроки' },
  { to: '/admin/cases', label: 'Кейсы' },
  { to: '/admin/promocodes', label: 'Промокоды' },
  { to: '/admin/finance', label: 'Финансы' },
];

export function AdminLayout(): ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Доступ проверяется и на сервере; здесь — чтобы не показывать пустые экраны
  useEffect(() => {
    if (user && !user.isAdmin) navigate('/', { replace: true });
  }, [user, navigate]);

  if (!user?.isAdmin) return <></>;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[760px] px-4 pb-10">
      <header className="safe-top sticky top-0 z-20 -mx-4 bg-bg/85 px-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/" className="press rounded-2xl bg-white/[0.06] p-2.5">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display text-lg font-extrabold">
              Админ-панель <span className="text-gradient">NEXUS</span>
            </h1>
            <p className="text-[11px] text-text-muted">Управление платформой</p>
          </div>
        </div>

        <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => clsx('chip', isActive && 'chip-active')}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="pt-3">
        <Outlet />
      </main>
    </div>
  );
}
