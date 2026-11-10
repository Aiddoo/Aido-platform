import { NUDGE_LIMITS, REMIND_NUDGE_LIMITS } from "@aido/api/vocabulary";

import { calculateCooldown } from "#api/shared/domain/date/utils/cooldown";

export interface NudgeCooldown {
  isActive: boolean;
  remainingSeconds: number;
  cooldownEndsAt: Date | null;
}

export function evaluateNudgeCooldown(lastNudgeTime: Date | null): NudgeCooldown {
  const { isActive, remainingSeconds, endsAt } = calculateCooldown(
    lastNudgeTime,
    NUDGE_LIMITS.COOLDOWN_HOURS,
  );
  return { isActive, remainingSeconds, cooldownEndsAt: endsAt };
}

export function evaluateRemindNudgeCooldown(lastNudgeTime: Date | null): NudgeCooldown {
  const { isActive, remainingSeconds, endsAt } = calculateCooldown(
    lastNudgeTime,
    REMIND_NUDGE_LIMITS.COOLDOWN_HOURS,
  );
  return { isActive, remainingSeconds, cooldownEndsAt: endsAt };
}
