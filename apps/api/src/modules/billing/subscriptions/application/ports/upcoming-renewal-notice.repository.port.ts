import { BillingNoticeRepositoryPort } from "../../../premium-grants/application/ports/billing-notice.port.js";

/** 이번 기간에 아직 갱신 안내를 보내지 않은, 연간으로 자동 갱신될 구독 */
export interface UpcomingRenewalNotice {
  readonly subscriptionId: number;
  readonly userId: string;
  /** 지금 기간의 끝 = 다음 결제 예정 시각 */
  readonly expiresAt: Temporal.Instant;
  /** 이 사용자의 다음 결제를 정하는 현재 체인인지(currentStoreChainOf) */
  readonly isCurrentChain: boolean;
}

export abstract class UpcomingRenewalNoticeRepositoryPort extends BillingNoticeRepositoryPort<UpcomingRenewalNotice> {}
