import { CHEER_LIMITS } from "@aido/api/vocabulary";

import {
  evaluateSendCooldown,
  type SendCooldown,
} from "../../shared/domain/send-cooldown.domain-service.js";

// 같은 친구에게는 마지막 응원부터 정해진 시간 동안 다시 보낼 수 없다
export function evaluateCheerCooldown(params: {
  readonly lastSentAt: Temporal.Instant | null;
  readonly now: Temporal.Instant;
}): SendCooldown {
  return evaluateSendCooldown({ ...params, cooldownHours: CHEER_LIMITS.COOLDOWN_HOURS });
}
