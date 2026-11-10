import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { calculateCooldown } from "#api/shared/domain/date/utils/cooldown";

export interface CheerCooldown {
  isActive: boolean;
  remainingSeconds: number;
  canCheerAt: Date | null;
}

export function evaluateCheerCooldown(lastCheerTime: Date | null): CheerCooldown {
  const { isActive, remainingSeconds, endsAt } = calculateCooldown(
    lastCheerTime,
    CHEER_LIMITS.COOLDOWN_HOURS,
  );
  return { isActive, remainingSeconds, canCheerAt: endsAt };
}
