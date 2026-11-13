import {
  ErrorCode,
  type ErrorCodeType,
  notChargedErrorDetailsSchema,
  quotaErrorDetailsSchema,
} from '@aido/api/errors';
import { isApiError } from '@src/core/errors/api-error';
import { ServerError } from '@src/shared/errors';

import { type EntitlementFeature } from './entitlement.model';

const LIMITED_FEATURE_BY_ERROR_CODE = {
  [ErrorCode.AI_1303]: 'AI_PARSE',
  [ErrorCode.AI_1313]: 'VOICE_NOTE',
  [ErrorCode.NUDGE_1101]: 'NUDGE',
  [ErrorCode.CHEER_1201]: 'CHEER',
  [ErrorCode.FOLLOW_0909]: 'FRIEND',
  [ErrorCode.TODO_CATEGORY_0857]: 'TODO_CATEGORY',
  [ErrorCode.AI_1308]: 'AI_REPORT',
  [ErrorCode.AI_1309]: 'AI_SUGGESTION',
  [ErrorCode.PREFERENCE_1701]: 'CUSTOM_REMINDER_TIME',
} as const satisfies Partial<Record<ErrorCodeType, EntitlementFeature>>;

type LimitedErrorCode = keyof typeof LIMITED_FEATURE_BY_ERROR_CODE;

function isLimitedErrorCode(code: string): code is LimitedErrorCode {
  return Object.hasOwn(LIMITED_FEATURE_BY_ERROR_CODE, code);
}

/** 한도에 막힌 오류의 기능. 한도 게이트가 안내 시트로 보인다 */
export function findLimitedFeatureByErrorCode(error: unknown): EntitlementFeature | null {
  if (!isApiError(error) || !isLimitedErrorCode(error.code)) {
    return null;
  }
  return LIMITED_FEATURE_BY_ERROR_CODE[error.code];
}

/** 처리 중·길이 초과처럼 한도 오류가 아니어도 서버가 함께 준 현재 한도 상세. 없으면 null */
export function findQuotaErrorDetails(error: unknown) {
  if (!isApiError(error)) {
    return null;
  }
  const details = quotaErrorDetailsSchema.safeParse(error.details);
  return details.success ? details.data : null;
}

export function isLimitedFeatureError(error: unknown): boolean {
  return findLimitedFeatureByErrorCode(error) != null;
}

/** AI 업체 장애(AI_1301)는 503이라 ServerError로 오고, 처리 중(AI_1314) 같은 4xx는 ApiError로 온다. 둘 다 details를 본다 */
export function isFreeOfChargeError(error: unknown): boolean {
  if (isApiError(error) || error instanceof ServerError) {
    return notChargedErrorDetailsSchema.safeParse(error.details).success;
  }
  return false;
}
