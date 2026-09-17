import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LogOut, Ticket, Users, Wallet } from 'lucide-react';
import { displayName, formatCoins, levelTitle } from '@nexus/shared';
import { api, setToken } from '../lib/api';
import { useAuth } from '../store/auth';
import { Avatar, Button, Card, ProgressBar, SectionTitle, StatTile, rarityClass } from '../components/ui';
import type { ReactElement } from 'react';

export function ProfilePage(): ReactElement {
  const { user, retry } = useAuth();
  const openings = useQuery({ queryKey: ['openings'], queryFn: () => api.user.openings() });

  if (!user) return <></>;

  const logout = (): void => {
    setToken(null);
    retry();
  };

  return (
    <div className="space-y-5">
      <Card glow className="text-center">
        <div className="flex flex-col items-center gap-2">
          <Avatar src={user.avatar} name={displayName(user)} size={78} ring />
          <h1 className="mt-1 font-display text-xl font-extrabold">{displayName(user)}</h1>
          <p className="text-[12px] text-text-muted">ID: {user.telegramId}</p>

          <span className={`mt-1 rounded-full px-3 py-1 text-[11px] font-bold ${rarityClass('EPIC')}`}>
            {levelTitle(user.level)} · Ур. {user.level}
          </span>

          <div className="mt-3 w-full">
            <ProgressBar percent={user.progress.percent} />
            <p className="mt-1.5 text-[11px] text-text-muted">
              {user.progress.isMax
                ? 'Максимальный уровень'
                : `${user.progress.xpIntoLevel} / ${user.progress.xpForNextLevel} XP до уровня ${user.level + 1}`}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Баланс" value={`${formatCoins(user.balance)} B`} tone="primary" />
        <StatTile label="Открыто кейсов" value={user.stats.casesOpened} />
        <StatTile label="Всего выиграно" value={`${formatCoins(user.stats.totalWon)} B`} tone="success" />
        <StatTile label="Рефералов" value={user.stats.referrals} hint={`${formatCoins(user.stats.referralEarned)} B заработано`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/deposit">
          <Button fullWidth icon={<Wallet size={16} />}>
            Пополнить
          </Button>
        </Link>
        <Link to="/withdraw">
          <Button fullWidth variant="ghost">
            Вывести
          </Button>
        </Link>
      </div>

      <section>
        <SectionTitle title="Разделы" />
        <div className="glass divide-y divide-white/5 overflow-hidden p-0">
          <MenuLink to="/promo" icon={<Ticket size={17} className="text-warning" />} label="Промокод" />
          <MenuLink to="/referrals" icon={<Users size={17} className="text-secondary" />} label="Рефералы" />
          <MenuLink to="/history" icon={<span className="text-[17px]">📜</span>} label="История операций" />
          <MenuLink to="/notifications" icon={<span className="text-[17px]">🔔</span>} label="Уведомления" />
          {user.isAdmin && (
            <MenuLink to="/admin" icon={<span className="text-[17px]">🛡</span>} label="Админ-панель" />
          )}
        </div>
      </section>

      <section>
        <SectionTitle title="Последние открытия" />
        <div className="space-y-2">
          {(openings.data?.items ?? []).slice(0, 6).map((opening) => (
            <div key={opening.id} className="glass-soft flex items-center gap-3 px-3 py-2.5">
              <span className="text-xl">{opening.caseImage}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{opening.caseName}</p>
                <p className="text-[11px] text-text-muted">
                  {new Date(opening.createdAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span
                className={`font-display text-[13px] font-bold tabular-nums ${
                  opening.profit >= 0 ? 'text-success' : 'text-text-muted'
                }`}
              >
                +{formatCoins(opening.amount)} B
              </span>
            </div>
          ))}
          {openings.data?.items.length === 0 && (
            <p className="px-1 py-4 text-center text-[13px] text-text-muted">Кейсы ещё не открывались</p>
          )}
        </div>
      </section>

      <button
        onClick={logout}
        className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-line/70 py-3 text-[13px] font-semibold text-text-muted"
      >
        <LogOut size={15} />
        Выйти из сессии
      </button>
    </div>
  );
}

function MenuLink({ to, icon, label }: { to: string; icon: ReactElement; label: string }): ReactElement {
  return (
    <Link to={to} className="press flex items-center gap-3 px-4 py-3.5">
      {icon}
      <span className="flex-1 text-[14px] font-semibold">{label}</span>
      <ChevronRight size={16} className="text-text-muted" />
    </Link>
  );
}
