import type { BillingNoticeSourcePort } from "./billing-notice.port.js";

export const UPCOMING_RENEWAL_NOTICE_SOURCE = Symbol("UPCOMING_RENEWAL_NOTICE_SOURCE");

/** 이번 기간에 아직 갱신 안내를 보내지 않은, 연간으로 자동 갱신될 구독 */
export interface UpcomingRenewalNotice {
  readonly subscriptionId: number;
  readonly userId: string;
  /** 지금 기간의 끝 = 다음 결제 예정 시각 */
  readonly expiresAt: Date;
}

export type UpcomingRenewalNoticeSourcePort = BillingNoticeSourcePort<UpcomingRenewalNotice>;
