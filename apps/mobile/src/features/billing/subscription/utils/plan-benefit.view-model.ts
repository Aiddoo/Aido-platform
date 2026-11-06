import { PLAN_CATALOG } from '@aido/api/vocabulary';

import { type EntitlementSnapshot, EntitlementPolicy } from '../domains/entitlement.model';

const SECONDS_PER_MINUTE = 60;

export function toPremiumBenefitAmounts() {
  return {
    aiParse: PLAN_CATALOG.AI_PARSE.fairUse.premium,
    voiceNote: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
    voiceNoteMinutes: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium / SECONDS_PER_MINUTE,
    category: PLAN_CATALOG.TODO_CATEGORY.premium,
  } as const;
}

export function toPlanBenefitAmounts(snapshot: EntitlementSnapshot) {
  return {
    free: {
      aiParse: EntitlementPolicy.getFreeLimit(snapshot, 'AI_PARSE'),
      voiceNote: EntitlementPolicy.getFreeLimit(snapshot, 'VOICE_NOTE'),
      voiceNoteMinutes: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.free / SECONDS_PER_MINUTE,
      nudge: EntitlementPolicy.getFreeLimit(snapshot, 'NUDGE'),
      friend: EntitlementPolicy.getFreeLimit(snapshot, 'FRIEND'),
      category: EntitlementPolicy.getFreeLimit(snapshot, 'TODO_CATEGORY'),
    },
    premium: toPremiumBenefitAmounts(),
  } as const;
}
