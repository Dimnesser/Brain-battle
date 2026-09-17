/** Ключ дня в UTC: 2025-04-20. Используется для защиты от повторных бонусов. */
export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Момент следующей полуночи UTC. */
export function nextUtcMidnight(from = new Date()): Date {
  const next = new Date(from);
  next.setUTCHours(24, 0, 0, 0);
  return next;
}

/** Сколько секунд осталось до конца текущих суток UTC. */
export function secondsUntilMidnight(from = new Date()): number {
  return Math.max(0, Math.floor((nextUtcMidnight(from).getTime() - from.getTime()) / 1000));
}

export function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function startOfUtcDay(date = new Date()): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/** Разница в календарных днях UTC — база для серии входов. */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}
