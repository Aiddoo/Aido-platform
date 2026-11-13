import { BillingNoticeRepositoryPort } from "../../../shared/application/ports/billing-notice.repository.port.js";

/** 스토어 구독도 다음 보상 기간도 이어지지 않는 마지막 보상 기간 */
export interface PremiumGrantEndingNotice {
  readonly grantId: string;
  readonly userId: string;
  readonly endsAt: Temporal.Instant;
}

export abstract class PremiumGrantEndingNoticeRepositoryPort extends BillingNoticeRepositoryPort<PremiumGrantEndingNotice> {}
