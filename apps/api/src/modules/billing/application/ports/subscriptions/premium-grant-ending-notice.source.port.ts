import type { BillingNoticeSourcePort } from "./billing-notice.port.js";

export const PREMIUM_GRANT_ENDING_NOTICE_SOURCE = Symbol("PREMIUM_GRANT_ENDING_NOTICE_SOURCE");

/** 스토어 구독도 다음 보상 기간도 이어지지 않는 마지막 보상 기간 */
export interface PremiumGrantEndingNotice {
  readonly grantId: string;
  readonly userId: string;
  readonly endsAt: Date;
}

export type PremiumGrantEndingNoticeSourcePort = BillingNoticeSourcePort<PremiumGrantEndingNotice>;
