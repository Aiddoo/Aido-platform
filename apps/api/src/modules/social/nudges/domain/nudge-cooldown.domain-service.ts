import { NUDGE_LIMITS, REMIND_NUDGE_LIMITS } from "@aido/api/vocabulary";

import {
  evaluateSendCooldown,
  type SendCooldown,
} from "../../shared/domain/send-cooldown.domain-service.js";

interface EvaluateNudgeCooldownParams {
  readonly lastSentAt: Temporal.Instant | null;
  readonly now: Temporal.Instant;
}

export function evaluateNudgeCooldown(params: EvaluateNudgeCooldownParams): SendCooldown {
  return evaluateSendCooldown({ ...params, cooldownHours: NUDGE_LIMITS.COOLDOWN_HOURS });
}

export function evaluateRemindNudgeCooldown(params: EvaluateNudgeCooldownParams): SendCooldown {
  return evaluateSendCooldown({ ...params, cooldownHours: REMIND_NUDGE_LIMITS.COOLDOWN_HOURS });
}
