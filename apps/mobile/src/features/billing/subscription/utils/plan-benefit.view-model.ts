import { PLAN_CATALOG } from '@aido/api/vocabulary';

import { type EntitlementSnapshot } from '../domains/entitlement.model';
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
      friend: EntitlementPolicy.getFreeLimit(snapshot, 'FRIEND'),
      category: EntitlementPolicy.getFreeLimit(snapshot, 'TODO_CATEGORY'),
    },
    premium: getPremiumBenefitAmounts(),
  } as const;
}
