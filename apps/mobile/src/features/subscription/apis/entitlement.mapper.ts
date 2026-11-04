import {
  type EntitlementSnapshot as EntitlementSnapshotDto,
  type FeatureQuota as FeatureQuotaDto,
  notChargedErrorDetailsSchema,
  PLAN_FEATURE_KEYS,
  quotaErrorDetailsSchema,
} from '@aido/api';
import { ErrorCode, type ErrorCodeType } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors/api-error';
import { mapValues, pick } from 'es-toolkit';

import {
  type EntitlementFeature,
  type EntitlementSnapshot,
  entitlementSnapshotSchema,
  type FeatureQuota,
  featureQuotaSchema,
} from '../domains/entitlement.model';

export const toFeatureQuota = (dto: FeatureQuotaDto): FeatureQuota =>
  featureQuotaSchema.parse({
    feature: dto.feature,
    allowed: dto.allowed,
    limit: dto.limit,
    used: dto.used,
    remaining: dto.remaining,
    period: dto.period,
    resetsAt: dto.resetsAt == null ? null : new Date(dto.resetsAt),
    isFairUse: dto.isFairUse,
    perUse:
      dto.perUse == null
        ? null
        : { maxSeconds: dto.perUse.maxSeconds, maxCharacters: dto.perUse.maxCharacters },
  } satisfies Record<keyof FeatureQuotaDto, unknown>);

// 새 서버가 더한 모르는 기능 키는 버린다
export const toEntitlementSnapshot = (dto: EntitlementSnapshotDto): EntitlementSnapshot =>
  entitlementSnapshotSchema.parse({
    isPremium: dto.isPremium,
    tier: dto.tier,
    features: mapValues(pick(dto.features, PLAN_FEATURE_KEYS), toFeatureQuota),
  } satisfies Record<keyof EntitlementSnapshotDto, unknown>);

/** 한도·프리미엄 전용 오류 코드가 막은 기능. 한도 안내는 이 표 한 곳에서만 코드를 기능으로 바꾼다 */
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
  /** 서버가 오류와 함께 준 현재 한도. 1.15.0 이전 서버나 상세가 없는 코드는 null이다 */
  featureQuota: FeatureQuota | null;
}

/** 서버가 한도·프리미엄 전용으로 막은 오류면 막힌 기능을, 아니면 null을 돌려준다 */
export function findLimitedFeature(error: unknown): LimitedFeature | null {
  if (!isApiError(error) || !isLimitedErrorCode(error.code)) {
    return null;
  }
  const details = quotaErrorDetailsSchema.safeParse(error.details);
  return {
    feature: LIMITED_FEATURE_BY_ERROR_CODE[error.code],
    featureQuota: details.success ? toFeatureQuota(details.data.featureQuota) : null,
  };
}

/** 서버가 이 요청으로 사용 횟수를 차감하지 않았다고 알린 오류인지 */
export function isNotChargedError(error: unknown): boolean {
  return isApiError(error) && notChargedErrorDetailsSchema.safeParse(error.details).success;
}
