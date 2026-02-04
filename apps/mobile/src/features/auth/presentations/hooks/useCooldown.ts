import { useEffect, useState } from 'react';

export const useCooldown = (initialValue = 0) => {
  const [cooldown, setCooldown] = useState(initialValue);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  return [cooldown, setCooldown] as const;
};
