import type { BillingNoticeSourcePort } from "./billing-notice.port.js";

export const TRIAL_ENDING_NOTICE_SOURCE = Symbol("TRIAL_ENDING_NOTICE_SOURCE");

/** 아직 종료 안내를 보내지 않은 무료 체험 구독 */
export interface TrialEndingNotice {
  readonly subscriptionId: number;
  readonly userId: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
  /** 해지하지 않아 체험이 끝나면 결제가 이어지는지 */
  readonly willRenew: boolean;
}

export type TrialEndingNoticeSourcePort = BillingNoticeSourcePort<TrialEndingNotice>;
