import type { SubscriptionPlanType } from "@aido/api/vocabulary";

import { BillingNoticeRepositoryPort } from "../../../shared/application/ports/billing-notice.repository.port.js";

/** 아직 종료 안내를 보내지 않은 무료 체험 구독 */
export interface TrialEndingNotice {
  readonly subscriptionId: number;
  readonly userId: string;
  readonly startedAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
  /** 해지하지 않아 체험이 끝나면 결제가 이어지는지 */
  readonly willRenew: boolean;
  /** 체험 뒤 이어질 요금제. 모르는 상품이면 null이다. */
  readonly planType: SubscriptionPlanType | null;
}

export abstract class TrialEndingNoticeRepositoryPort extends BillingNoticeRepositoryPort<TrialEndingNotice> {}
