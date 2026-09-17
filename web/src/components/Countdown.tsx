import { useEffect, useState } from 'react';
import { formatCountdown } from '@nexus/shared';
import type { ReactElement } from 'react';

/** Обратный отсчёт. По достижении нуля вызывает onComplete один раз. */
export function Countdown({
  seconds,
  onComplete,
  className,
}: {
  seconds: number;
  onComplete?: () => void;
  className?: string;
}): ReactElement {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (left <= 0) return;

    const timer = setInterval(() => {
      setLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          onComplete?.();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // onComplete намеренно не в зависимостях: таймер не должен перезапускаться
    // при каждом ре-рендере родителя
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left > 0]);

  return <span className={className}>{formatCountdown(left)}</span>;
}
