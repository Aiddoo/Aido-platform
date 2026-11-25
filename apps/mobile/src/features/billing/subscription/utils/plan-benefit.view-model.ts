import { SECONDS_PER_MINUTE } from '@src/shared/constants/time-units';

import {
  type EntitlementSnapshot,
  EntitlementPolicy,
  type PlanValue,
} from '../domains/entitlement.model';
import { type EntitlementFeature } from '../domains/feature-quota.model';

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

type BenefitQuotaLabel =
  | { type: 'premiumOnly' }
  | { type: 'upgrade'; free: PlanValue; premium: PlanValue };

export function toBenefitQuotaLabel(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): BenefitQuotaLabel {
  const { free, premium } = EntitlementPolicy.getPlanFeatureComparison(snapshot, feature);
  return free.type === 'excluded' ? { type: 'premiumOnly' } : { type: 'upgrade', free, premium };
}
