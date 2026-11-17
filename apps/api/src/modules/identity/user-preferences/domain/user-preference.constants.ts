import type { TIME_FORMATS } from "@aido/api/vocabulary";

export type TimeFormatValue = (typeof TIME_FORMATS)[number];

/** 광고성 정보 수신 동의를 다시 알리는 주기(년). 정보통신망법 시행령 제62조 */
export const MARKETING_CONSENT_RECONFIRM_YEARS = 2;
