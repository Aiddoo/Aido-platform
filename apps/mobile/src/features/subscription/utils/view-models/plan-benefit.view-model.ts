import { PLAN_CATALOG } from '@aido/api/vocabulary';

import { type EntitlementSnapshot, EntitlementPolicy } from '../../domains/entitlement.model';

/** 말로 메모하기 한 번 길이는 초로 오고 안내는 분으로 한다 */
const SECONDS_PER_MINUTE = 60;

/** 프리미엄이 주는 양. 숫자는 PLAN_CATALOG에서만 읽는다 */
export function toPremiumBenefitAmounts() {
  return {
    aiParse: PLAN_CATALOG.AI_PARSE.fairUse.premium,
    voiceNote: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
    voiceNoteMinutes: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium / SECONDS_PER_MINUTE,
    category: PLAN_CATALOG.TODO_CATEGORY.premium,
  } as const;
}

/**
 * 결제 화면 혜택 행의 "무료는 …, 프리미엄은 …" 숫자. 무료 쪽은 초대로 늘어난 자리까지 반영한 서버 값을 쓴다
 */
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
