import { useEffect, useState } from 'react';

const COOLDOWN_TICK_MS = 1_000;

export function useCooldown(initialValue = 0) {
  const [cooldown, setCooldown] = useState(initialValue);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, COOLDOWN_TICK_MS);

    return () => clearTimeout(timer);
  }, [cooldown]);

  return [cooldown, setCooldown] as const;
}
