import {
  type EntitlementSnapshot as EntitlementSnapshotDto,
  entitlementSnapshotSchema,
  type FeatureQuota as FeatureQuotaDto,
  featureQuotaSchema,
} from '@aido/api/contracts/entitlement/v1';
import type { ErrorCodeType } from '@aido/api/errors';
import {
  type AccessTier,
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  type Plan,
  type PlanFeature,
} from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { createApiError } from '@src/testing/api-error';
import { match } from 'ts-pattern';

import { toEntitlementSnapshot } from '../apis/entitlement.mapper';
import { type EntitlementSnapshot } from '../domains/entitlement.model';

/** 다음 달 1일 00:00 KST */
export const MONTHLY_RESETS_AT = '2026-11-30T15:00:00.000Z';
/** 다음 날 00:00 KST */
export const DAILY_RESETS_AT = '2026-11-05T15:00:00.000Z';

/** 서버 planOfTier처럼 ADMIN은 프리미엄 요금제의 기능·한도를 받는다(무제한 경로가 없다) */
function getPlanOfTier(tier: AccessTier): Plan {
  return match(tier)
    .returnType<Plan>()
    .with('FREE', () => 'free')
    .with('PREMIUM', 'ADMIN', () => 'premium')
    .exhaustive();
}

/** 등급별로 서버가 보낼 기능 한도(사용량 0). 횟수는 PLAN_CATALOG에서만 읽는다 */
function createDefaultFeatureQuota(feature: PlanFeature, tier: AccessTier): FeatureQuotaDto {
  const definition = PLAN_CATALOG[feature];
  const plan = getPlanOfTier(tier);
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
    return { ...base, allowed: definition[plan] };
  }
  if (definition.kind === 'horizon') {
    const limit = definition[plan];
    return { ...base, allowed: limit > 0, limit };
  }
  if (definition.kind === 'resource') {
    return { ...base, limit: definition[plan] };
  }

  const fairUseLimit = 'fairUse' in definition ? definition.fairUse.premium : null;
  const limit = plan === 'free' ? definition.free : fairUseLimit;
  const perUse =
    'perUse' in definition
      ? {
          maxSeconds: definition.perUse.maxSeconds[plan],
          maxCharacters: definition.perUse.maxCharacters[plan],
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
    isFairUse: plan === 'premium' && fairUseLimit != null,
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

type PlanFeatureLimitDto = EntitlementSnapshotDto['plans'][PlanFeature]['free'];

/** 서버 resolvePlanComparisons처럼 요금제 값을 받은 자리 없이 카탈로그에서 읽는다 */
function createPlanFeatureLimitDto(feature: PlanFeature, plan: Plan): PlanFeatureLimitDto {
  const definition = PLAN_CATALOG[feature];
  if (definition.kind === 'flag') {
    return { allowed: definition[plan], limit: null, isFairUse: false, perUse: null };
  }
  if (definition.kind === 'horizon') {
    return {
      allowed: definition[plan] > 0,
      limit: definition[plan],
      isFairUse: false,
      perUse: null,
    };
  }
  const fairUseLimit =
    plan === 'premium' && 'fairUse' in definition ? definition.fairUse.premium : null;
  const limit = definition[plan] ?? fairUseLimit;
  return {
    allowed: limit == null || limit > 0,
    limit,
    isFairUse: definition[plan] == null && fairUseLimit != null,
    perUse:
      'perUse' in definition
        ? {
            maxSeconds: definition.perUse.maxSeconds[plan],
            maxCharacters: definition.perUse.maxCharacters[plan],
          }
        : null,
  };
}

/** GET /v1/entitlements 응답. 기본은 아무것도 쓰지 않은 무료 사용자이고 요금제 값은 카탈로그와 같다 */
export function createEntitlementSnapshotDto({
  tier = 'FREE',
  isPremium = tier === 'PREMIUM',
  used = {},
  plans = {},
}: {
  tier?: AccessTier;
  isPremium?: boolean;
  used?: Partial<Record<PlanFeature, number>>;
  /** 운영 중 바뀐 요금제 값을 흉내 낸다 */
  plans?: Partial<EntitlementSnapshotDto['plans']>;
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
    plans: Object.fromEntries(
      PLAN_FEATURE_KEYS.map((feature) => [
        feature,
        plans[feature] ?? {
          free: createPlanFeatureLimitDto(feature, 'free'),
          premium: createPlanFeatureLimitDto(feature, 'premium'),
        },
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
  return createApiError(code, { message: '한도 오류', status, details });
}
