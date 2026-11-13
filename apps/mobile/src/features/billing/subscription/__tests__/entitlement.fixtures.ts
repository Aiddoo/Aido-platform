import {
  type AccessTier,
  type EntitlementSnapshot as EntitlementSnapshotDto,
  entitlementSnapshotSchema,
  type FeatureQuota as FeatureQuotaDto,
  featureQuotaSchema,
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  type PlanFeature,
} from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { match } from 'ts-pattern';

import { toEntitlementSnapshot } from '../apis/entitlement.mapper';
import { type EntitlementSnapshot } from '../domains/entitlement.model';

/** 다음 달 1일 00:00 KST */
export const MONTHLY_RESETS_AT = '2026-11-30T15:00:00.000Z';
/** 다음 날 00:00 KST */
export const DAILY_RESETS_AT = '2026-11-05T15:00:00.000Z';

/** 등급별로 서버가 보낼 기능 한도(사용량 0). 횟수는 PLAN_CATALOG에서만 읽는다 */
function createDefaultFeatureQuota(feature: PlanFeature, tier: AccessTier): FeatureQuotaDto {
  const definition = PLAN_CATALOG[feature];
  const base = {
    feature,
    allowed: true,
    limit: null,
    used: null,
    remaining: null,
    period: null,
    resetsAt: null,
    isFairUse: false,
    perUse: null,
  } satisfies FeatureQuotaDto;

  if (definition.kind === 'flag') {
    return {
      ...base,
      allowed: tier === 'ADMIN' || definition[tier === 'FREE' ? 'free' : 'premium'],
    };
  }
  if (tier === 'ADMIN') {
    return base;
  }
  if (definition.kind === 'resource') {
    return { ...base, limit: tier === 'FREE' ? definition.free : definition.premium };
  }

  const fairUseLimit = 'fairUse' in definition ? definition.fairUse.premium : null;
  const limit = tier === 'FREE' ? definition.free : fairUseLimit;
  const perUse =
    'perUse' in definition
      ? {
          maxSeconds: definition.perUse.maxSeconds[tier === 'FREE' ? 'free' : 'premium'],
          maxCharacters: definition.perUse.maxCharacters[tier === 'FREE' ? 'free' : 'premium'],
        }
      : null;
  if (limit == null) {
    return { ...base, perUse };
  }
  return {
    ...base,
    limit,
    used: 0,
    remaining: limit,
    period: definition.period,
    resetsAt: match(definition.period)
      .with('month', () => MONTHLY_RESETS_AT)
      .with('day', () => DAILY_RESETS_AT)
      .exhaustive(),
    isFairUse: tier !== 'FREE' && fairUseLimit != null,
    perUse,
  };
}

/** 기능 하나를 쓴 만큼 줄인 한도. 계약 스키마로 검증해 서버가 보낼 수 없는 모양은 여기서 실패한다 */
export function createFeatureQuotaDto(
  feature: PlanFeature,
  { tier = 'FREE', used }: { tier?: AccessTier; used?: number } = {},
): FeatureQuotaDto {
  const quota = createDefaultFeatureQuota(feature, tier);
  if (used == null || quota.limit == null) {
    return featureQuotaSchema.parse(quota);
  }
  return featureQuotaSchema.parse({
    ...quota,
    used,
    remaining: Math.max(quota.limit - used, 0),
  });
}

/** GET /v1/entitlements 응답. 기본은 아무것도 쓰지 않은 무료 사용자다 */
export function createEntitlementSnapshotDto({
  tier = 'FREE',
  isPremium = tier === 'PREMIUM',
  used = {},
}: {
  tier?: AccessTier;
  isPremium?: boolean;
  used?: Partial<Record<PlanFeature, number>>;
} = {}): EntitlementSnapshotDto {
  return entitlementSnapshotSchema.parse({
    isPremium,
    tier,
    features: Object.fromEntries(
      PLAN_FEATURE_KEYS.map((feature) => [
        feature,
        createFeatureQuotaDto(feature, { tier, used: used[feature] }),
      ]),
    ),
  });
}

export function createEntitlementSnapshot(
  options?: Parameters<typeof createEntitlementSnapshotDto>[0],
): EntitlementSnapshot {
  return toEntitlementSnapshot(createEntitlementSnapshotDto(options));
}

/** 서버 한도 오류. details는 운영 응답처럼 공개 상세 스키마 모양이다 */
export function createLimitApiError(
  code: ErrorCodeType,
  details?: Record<string, unknown>,
  status = 429,
): ApiError {
  return new ApiError(code, '한도 오류', status, details);
}
