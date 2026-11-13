import { ErrorCode, type ErrorCodeType } from "@aido/api/errors";
import type { MeteredFeatureKey } from "@aido/api/vocabulary";

import type { FeatureQuotaDetails } from "#api/modules/access/entitlements/access-entitlements.public";
import { ApplicationException } from "#api/shared/application/application.exception";

/** 기능별 한도 초과 코드. 출시 앱은 AI_PARSE의 AI_1303을 안다. */
const QUOTA_EXHAUSTED_ERROR = {
  AI_PARSE: ErrorCode.AI_1303,
  VOICE_NOTE: ErrorCode.AI_1313,
} as const satisfies Record<MeteredFeatureKey, ErrorCodeType>;

export function authenticationRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.AUTH_0107);
}

/** 한도에 닿아 차감하지 않았다. 앱은 서버가 계산한 현재 한도를 그대로 보여 준다. */
export function quotaExhausted(
  feature: MeteredFeatureKey,
  featureQuota: FeatureQuotaDetails,
): ApplicationException {
  return new ApplicationException(QUOTA_EXHAUSTED_ERROR[feature], {
    charged: false,
    featureQuota,
  });
}

/** 같은 키 요청이 아직 처리 중이다. 차감하지 않았다. */
export function quotaReservationInFlight(featureQuota: FeatureQuotaDetails): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1314, { charged: false, featureQuota });
}

/** 같은 키로 작업이나 내용이 다른 요청이다. 차감하지 않았다. */
export function quotaKeyReused(): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1318, { charged: false });
}

/** 같은 사용자·계량기·키의 차감을 동시에 만들었다. 저장소 제약을 출시 앱이 받던 SYS_0004로 옮긴다. */
export function quotaChargeConflict(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0004);
}
