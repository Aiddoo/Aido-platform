import {
  type FeatureQuota as FeatureQuotaDto,
  type EntitlementSnapshot as EntitlementSnapshotDto,
  PLAN_FEATURE_KEYS,
} from '@aido/api';
import { toNullableInstant } from '@src/shared/date/instant';
import { mapValues, pick } from 'es-toolkit';

import {
  type EntitlementSnapshot,
  entitlementSnapshotSchema,
  type FeatureQuota,
  featureQuotaSchema,
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
