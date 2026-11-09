import type { SubscriptionPlanType } from "@aido/api/vocabulary";

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
  /** 체험 뒤 이어질 요금제. 모르는 상품이면 null이다. */
  readonly planType: SubscriptionPlanType | null;
}

export type TrialEndingNoticeSourcePort = BillingNoticeSourcePort<TrialEndingNotice>;
