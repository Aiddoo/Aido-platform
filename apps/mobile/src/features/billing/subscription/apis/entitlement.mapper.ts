import {
  type FeatureQuota as FeatureQuotaDto,
  type EntitlementSnapshot as EntitlementSnapshotDto,
  PLAN_FEATURE_KEYS,
} from '@aido/api';
import { toNullableInstant } from '@src/shared/date/instant';
import { mapValues, pick } from 'es-toolkit';

import { findLimitedFeatureByErrorCode, findQuotaErrorDetails } from '../domains/entitlement.error';
import {
  type EntitlementSnapshot,
  entitlementSnapshotSchema,
  type FeatureQuota,
  featureQuotaSchema,
  type LimitedFeature,
} from '../domains/entitlement.model';

export function toFeatureQuota(dto: FeatureQuotaDto): FeatureQuota {
  return featureQuotaSchema.parse({
    feature: dto.feature,
    allowed: dto.allowed,
    limit: dto.limit,
    used: dto.used,
    remaining: dto.remaining,
    period: dto.period,
    resetsAt: toNullableInstant(dto.resetsAt),
    isFairUse: dto.isFairUse,
    perUse:
      dto.perUse == null
        ? null
        : { maxSeconds: dto.perUse.maxSeconds, maxCharacters: dto.perUse.maxCharacters },
  } satisfies Record<keyof FeatureQuotaDto, unknown>);
}

// 새 서버가 더한 모르는 기능 키는 버린다
export function toEntitlementSnapshot(dto: EntitlementSnapshotDto): EntitlementSnapshot {
  return entitlementSnapshotSchema.parse({
    isPremium: dto.isPremium,
    tier: dto.tier,
    features: mapValues(pick(dto.features, PLAN_FEATURE_KEYS), toFeatureQuota),
  } satisfies Record<keyof EntitlementSnapshotDto, unknown>);
}

/** 한도 오류의 기능과 서버가 함께 준 현재 한도. 한도 오류가 아니면 null이다 */
export function parseLimitedFeature(error: unknown): LimitedFeature | null {
  const feature = findLimitedFeatureByErrorCode(error);
  if (feature == null) {
    return null;
  }
  return { feature, featureQuota: parseErrorFeatureQuota(error) };
}

export function parseErrorFeatureQuota(error: unknown): FeatureQuota | null {
  const details = findQuotaErrorDetails(error);
  return details == null ? null : toFeatureQuota(details.featureQuota);
}
