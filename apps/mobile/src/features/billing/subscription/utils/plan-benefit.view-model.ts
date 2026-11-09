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

/** 비교 칸 하나의 값. 켜고 끄는 기능은 포함 여부만 있다 */
export type PlanValue =
  | { type: 'amount'; unit: PlanComparison['unit']; amount: number }
  | { type: 'unlimited' }
  | { type: 'included' }
  | { type: 'excluded' };

interface PlanFeatureComparison {
  free: PlanValue;
  premium: PlanValue;
}

function toPlanValue(unit: PlanComparison['unit'], amount: number | null): PlanValue {
  return amount == null ? { type: 'unlimited' } : { type: 'amount', unit, amount };
}

/** 비교표 한 줄. 숫자는 getPlanComparison, 켜고 끄는 기능은 무료에 없고 프리미엄에 있다 */
export function toPlanFeatureComparison(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): PlanFeatureComparison {
  return match(feature)
    .with('AI_REPORT', 'AI_SUGGESTION', 'CUSTOM_REMINDER_TIME', 'APP_ICON', () => ({
      free: { type: 'excluded' } as const,
      premium: { type: 'included' } as const,
    }))
    .with('AI_PARSE', 'VOICE_NOTE', 'CHEER', 'NUDGE', 'FRIEND', 'TODO_CATEGORY', (limitFeature) => {
      const { unit, free, premium } = getPlanComparison(snapshot, limitFeature);
      return { free: toPlanValue(unit, free), premium: toPlanValue(unit, premium) };
    })
    .exhaustive();
}

type BenefitQuotaLabel =
  | { type: 'premiumOnly' }
  | { type: 'upgrade'; free: PlanValue; premium: PlanValue };

/** 혜택 장 아래 한도 띠. 무료에 없는 기능은 "프리미엄 전용", 있으면 "무료 → 프리미엄" 양이다 */
export function toBenefitQuotaLabel(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): BenefitQuotaLabel {
  const { free, premium } = toPlanFeatureComparison(snapshot, feature);
  return free.type === 'excluded' ? { type: 'premiumOnly' } : { type: 'upgrade', free, premium };
}
