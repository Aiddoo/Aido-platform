import { REMIND_NUDGE_LIMITS } from "@aido/api/vocabulary";

import {
  evaluateSendCooldown,
  type SendCooldown,
} from "../../shared/domain/send-cooldown.domain-service.js";

// 같은 친구에게 보낸 마지막 리마인드 콕부터 센다
export function evaluateReminderNudgeCooldown(params: {
  readonly lastSentAt: Temporal.Instant | null;
  readonly now: Temporal.Instant;
}): SendCooldown {
  return evaluateSendCooldown({ ...params, cooldownHours: REMIND_NUDGE_LIMITS.COOLDOWN_HOURS });
}
