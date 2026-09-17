/** Форматирование внутренней валюты: 1250 -> "1 250". */
export function formatCoins(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return sign + Math.abs(Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Компактный вид для рейтингов: 12500 -> "12.5K". */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (abs >= 10_000) return `${(amount / 1000).toFixed(1).replace('.0', '')}K`;
  return formatCoins(amount);
}

/** Секунды -> "01:42:18". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return [hours, minutes, seconds].map((v) => v.toString().padStart(2, '0')).join(':');
}

/** Имя для интерфейса: username, имя или «Игрок». */
export function displayName(user: { username?: string | null; firstName?: string | null }): string {
  if (user.username) return `@${user.username}`;
  if (user.firstName) return user.firstName;
  return 'Игрок';
}

/** Маскирование реквизитов — попадает в UI и админку, но не в логи. */
export function maskRequisites(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '••••';
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-4)}`;
}
