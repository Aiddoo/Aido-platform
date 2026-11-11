import type { QuotaMeter } from "@aido/api/vocabulary";
import { applyDecorators, UseGuards } from "@nestjs/common";

import { REQUIRED_QUOTA_METER, RequireQuotaGuard } from "../guards/require-quota.guard.js";

/**
 * 남은 횟수가 0이면 차감 없이 기능별 한도 코드(AI_PLAN: AI_1303, VOICE_NOTE: AI_1313)와
 * `{ charged: false, featureQuota }`로 막는다. 실제 차감은 UseCase가 원장에 예약할 때 한 번이다.
 * 이 라우트의 모듈은 AccessQuotasModule을 import해야 한다.
 */
export function RequireQuota(meter: QuotaMeter) {
  return applyDecorators(REQUIRED_QUOTA_METER(meter), UseGuards(RequireQuotaGuard));
}
