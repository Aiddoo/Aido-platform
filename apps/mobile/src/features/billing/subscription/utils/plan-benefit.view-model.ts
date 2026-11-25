import type { PlanHorizonFeatureKey, PlanLimitFeatureKey } from '@aido/api/vocabulary';
import { SECONDS_PER_MINUTE } from '@src/shared/constants/time-units';
import { match } from 'ts-pattern';

import { type EntitlementFeature, type EntitlementSnapshot } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';

/** 숫자는 모두 서버 요금제 값이다. null은 무제한이고 화면은 "무제한"으로 쓴다 */
function toMinutes(seconds: number | null): number | null {
  return seconds == null ? null : seconds / SECONDS_PER_MINUTE;
}

export function getPremiumBenefitAmounts(snapshot: EntitlementSnapshot) {
  return {
    aiParse: EntitlementPolicy.findPlanLimit(snapshot, 'AI_PARSE', 'premium'),
    voiceNote: EntitlementPolicy.findPlanLimit(snapshot, 'VOICE_NOTE', 'premium'),
    voiceNoteMinutes: toMinutes(
      EntitlementPolicy.findPlanMaxSeconds(snapshot, 'VOICE_NOTE', 'premium'),
    ),
    category: EntitlementPolicy.findPlanLimit(snapshot, 'TODO_CATEGORY', 'premium'),
    calendarImportDays: EntitlementPolicy.findPlanLimit(snapshot, 'CALENDAR_IMPORT', 'premium'),
  } as const;
}

/** 무료 쪽은 초대로 늘어난 자리까지 포함한 내 한도다 */
export function getPlanBenefitAmounts(snapshot: EntitlementSnapshot) {
  return {
    free: {
      aiParse: EntitlementPolicy.findFreeLimit(snapshot, 'AI_PARSE'),
      voiceNote: EntitlementPolicy.findFreeLimit(snapshot, 'VOICE_NOTE'),
      voiceNoteMinutes: toMinutes(
        EntitlementPolicy.findPlanMaxSeconds(snapshot, 'VOICE_NOTE', 'free'),
      ),
      nudge: EntitlementPolicy.findFreeLimit(snapshot, 'NUDGE'),
      cheer: EntitlementPolicy.findFreeLimit(snapshot, 'CHEER'),
      friend: EntitlementPolicy.findFreeLimit(snapshot, 'FRIEND'),
      category: EntitlementPolicy.findFreeLimit(snapshot, 'TODO_CATEGORY'),
      calendarImportDays: EntitlementPolicy.findFreeLimit(snapshot, 'CALENDAR_IMPORT'),
    },
    premium: getPremiumBenefitAmounts(snapshot),
  } as const;
}

interface PlanComparison {
  unit: 'perMonth' | 'perDay' | 'people' | 'items' | 'days';
  /** null은 무제한이다 */
  free: number | null;
  /** null은 무제한이다 */
  premium: number | null;
}

/** 막힌 기능 하나의 "무료 → 프리미엄" 숫자. 프리미엄은 공정 사용 상한까지 서버가 집행하는 값이다 */
export function getPlanComparison(
  snapshot: EntitlementSnapshot,
  feature: PlanLimitFeatureKey | PlanHorizonFeatureKey,
): PlanComparison {
  return {
    unit: match(feature)
      .returnType<PlanComparison['unit']>()
      .with('AI_PARSE', 'VOICE_NOTE', () => 'perMonth')
      .with('CHEER', 'NUDGE', () => 'perDay')
      .with('FRIEND', () => 'people')
      .with('TODO_CATEGORY', () => 'items')
      .with('CALENDAR_IMPORT', () => 'days')
      .exhaustive(),
    free: EntitlementPolicy.findFreeLimit(snapshot, feature),
    premium: EntitlementPolicy.findPlanLimit(snapshot, feature, 'premium'),
  };
}

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

function toFlagPlanValue(canUse: boolean): PlanValue {
  return canUse ? { type: 'included' } : { type: 'excluded' };
}

export function toPlanFeatureComparison(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): PlanFeatureComparison {
  return match(feature)
    .with('AI_REPORT', 'AI_SUGGESTION', 'CUSTOM_REMINDER_TIME', 'APP_ICON', (flagFeature) => ({
      free: toFlagPlanValue(EntitlementPolicy.canUseOnPlan(snapshot, flagFeature, 'free')),
      premium: toFlagPlanValue(EntitlementPolicy.canUseOnPlan(snapshot, flagFeature, 'premium')),
    }))
    .with(
      'AI_PARSE',
      'VOICE_NOTE',
      'CHEER',
      'NUDGE',
      'FRIEND',
      'TODO_CATEGORY',
      'CALENDAR_IMPORT',
      (limitFeature) => {
        const { unit, free, premium } = getPlanComparison(snapshot, limitFeature);
        return { free: toPlanValue(unit, free), premium: toPlanValue(unit, premium) };
      },
    )
    .exhaustive();
}

type BenefitQuotaLabel =
  | { type: 'premiumOnly' }
  | { type: 'upgrade'; free: PlanValue; premium: PlanValue };

export function toBenefitQuotaLabel(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): BenefitQuotaLabel {
  const { free, premium } = toPlanFeatureComparison(snapshot, feature);
  return free.type === 'excluded' ? { type: 'premiumOnly' } : { type: 'upgrade', free, premium };
}
