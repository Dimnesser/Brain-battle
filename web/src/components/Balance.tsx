import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { formatCoins } from '@nexus/shared';
import type { ReactElement } from 'react';

/** Баланс с плавным пересчётом и всплывающей дельтой (+500 B). */
export function AnimatedBalance({ value, className }: { value: number; className?: string }): ReactElement {
  const [display, setDisplay] = useState(value);
  const [delta, setDelta] = useState<number | null>(null);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (from === value) return;
    if (from !== value) setDelta(value - from);

    // Короткая интерполяция: число «докручивается» к новому значению
    const duration = 600;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    const clear = setTimeout(() => setDelta(null), 1200);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(clear);
    };
  }, [value]);

  return (
    <span className={`relative inline-flex tabular-nums ${className ?? ''}`}>
      {formatCoins(display)}
      <AnimatePresence>
        {delta !== null && delta !== 0 && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: -14 }}
            exit={{ opacity: 0, y: -22 }}
            className={`absolute -right-1 -top-3 text-[11px] font-bold ${
              delta > 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {formatCoins(delta)}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
