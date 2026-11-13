import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import {
  evaluateSendCooldown,
  type SendCooldown,
} from "../../shared/domain/send-cooldown.domain-service.js";

// 같은 할 일에 보낸 마지막 콕부터 센다
export function evaluateNudgeCooldown(params: {
  readonly lastSentAt: Temporal.Instant | null;
  readonly now: Temporal.Instant;
}): SendCooldown {
  return evaluateSendCooldown({ ...params, cooldownHours: NUDGE_LIMITS.COOLDOWN_HOURS });
}
