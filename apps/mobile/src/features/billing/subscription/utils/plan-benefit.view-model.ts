import { PLAN_CATALOG, type PlanLimitFeatureKey } from '@aido/api/vocabulary';
import { match } from 'ts-pattern';

import { type EntitlementFeature, type EntitlementSnapshot } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';

const SECONDS_PER_MINUTE = 60;

export function getPremiumBenefitAmounts() {
  return {
    aiParse: PLAN_CATALOG.AI_PARSE.fairUse.premium,
    voiceNote: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
    voiceNoteMinutes: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium / SECONDS_PER_MINUTE,
    category: PLAN_CATALOG.TODO_CATEGORY.premium,
  } as const;
}

/** 무료 쪽은 초대로 늘어난 자리까지 포함한 내 한도다 */
export function getPlanBenefitAmounts(snapshot: EntitlementSnapshot) {
  return {
    free: {
      aiParse: EntitlementPolicy.getFreeLimit(snapshot, 'AI_PARSE'),
      voiceNote: EntitlementPolicy.getFreeLimit(snapshot, 'VOICE_NOTE'),
      voiceNoteMinutes: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.free / SECONDS_PER_MINUTE,
      nudge: EntitlementPolicy.getFreeLimit(snapshot, 'NUDGE'),
      cheer: EntitlementPolicy.getFreeLimit(snapshot, 'CHEER'),
      friend: EntitlementPolicy.getFreeLimit(snapshot, 'FRIEND'),
      category: EntitlementPolicy.getFreeLimit(snapshot, 'TODO_CATEGORY'),
    },
    premium: getPremiumBenefitAmounts(),
  } as const;
}

interface PlanComparison {
  unit: 'perMonth' | 'perDay' | 'people' | 'items';
  free: number;
  /** null은 무제한이다 */
  premium: number | null;
}

/** 막힌 기능 하나의 "무료 → 프리미엄" 숫자 */
export function getPlanComparison(
  snapshot: EntitlementSnapshot,
  feature: PlanLimitFeatureKey,
): PlanComparison {
  return match(feature)
    .with(
      'AI_PARSE',
      'VOICE_NOTE',
      (quotaFeature) =>
        ({
          unit: 'perMonth',
          free: EntitlementPolicy.getFreeLimit(snapshot, quotaFeature),
          premium: PLAN_CATALOG[quotaFeature].fairUse.premium,
        }) satisfies PlanComparison,
    )
    .with(
      'CHEER',
      'NUDGE',
      (quotaFeature) =>
        ({
          unit: 'perDay',
          free: EntitlementPolicy.getFreeLimit(snapshot, quotaFeature),
          premium: PLAN_CATALOG[quotaFeature].premium,
        }) satisfies PlanComparison,
    )
    .with(
      'FRIEND',
      (resourceFeature) =>
        ({
          unit: 'people',
          free: EntitlementPolicy.getFreeLimit(snapshot, resourceFeature),
          premium: PLAN_CATALOG[resourceFeature].premium,
        }) satisfies PlanComparison,
    )
    .with(
      'TODO_CATEGORY',
      (resourceFeature) =>
        ({
          unit: 'items',
          free: EntitlementPolicy.getFreeLimit(snapshot, resourceFeature),
          premium: PLAN_CATALOG[resourceFeature].premium,
        }) satisfies PlanComparison,
    )
    .exhaustive();
}

/** 막힌 기능은 페이월 맨 위 카드가 이미 설명하므로 아래 혜택 목록에서 한 번 더 보이지 않게 뺀다 */
export function excludeBlockedBenefit<TBenefit extends { feature: EntitlementFeature }>(
  benefits: readonly TBenefit[],
  blockedFeature: EntitlementFeature | undefined,
): TBenefit[] {
  return benefits.filter((benefit) => benefit.feature !== blockedFeature);
}
