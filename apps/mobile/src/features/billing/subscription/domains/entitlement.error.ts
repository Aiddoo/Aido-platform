import {
  ErrorCode,
  type ErrorCodeType,
  notChargedErrorDetailsSchema,
  quotaErrorDetailsSchema,
} from '@aido/api/errors';
import { isApiError } from '@src/core/errors/api-error';

import { toFeatureQuota } from '../apis/entitlement.mapper';
import { type EntitlementFeature, type FeatureQuota } from './entitlement.model';

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

export interface LimitedFeature {
  feature: EntitlementFeature;
  featureQuota: FeatureQuota | null;
}

export function findLimitedFeature(error: unknown): LimitedFeature | null {
  if (!isApiError(error) || !isLimitedErrorCode(error.code)) {
    return null;
  }
  return {
    feature: LIMITED_FEATURE_BY_ERROR_CODE[error.code],
    featureQuota: findErrorFeatureQuota(error),
  };
}

export function findErrorFeatureQuota(error: unknown): FeatureQuota | null {
  if (!isApiError(error)) {
    return null;
  }
  const details = quotaErrorDetailsSchema.safeParse(error.details);
  return details.success ? toFeatureQuota(details.data.featureQuota) : null;
}

export function isFreeOfChargeError(error: unknown): boolean {
  return isApiError(error) && notChargedErrorDetailsSchema.safeParse(error.details).success;
}
