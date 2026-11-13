import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import { SubscriptionId } from "./subscription-id.vo.js";

export interface UpcomingRenewalNoticePrimitives {
  readonly id: number;
  readonly userId: string;
  /** 지금 기간의 끝 = 다음 결제 예정 시각 */
  readonly expiresAt: Temporal.Instant;
  /** 이 사용자의 다음 결제를 정하는 현재 체인인지(currentStoreChainOf) */
  readonly isCurrentChain: boolean;
}

interface UpcomingRenewalNoticeProps {
  readonly userId: UserId;
  readonly expiresAt: Temporal.Instant;
  readonly isCurrentChain: boolean;
}

/**
 * 이번 기간에 한 번 알릴, 연간으로 자동 갱신될 구독(작업 원장 행). 기간마다 보냈다는 표시는 저장소의 조건부
 * 묶음 갱신(claim)이 남긴다.
 */
export class UpcomingRenewalNotice extends Entity<SubscriptionId, UpcomingRenewalNoticeProps> {
  static reconstitute(primitives: UpcomingRenewalNoticePrimitives): UpcomingRenewalNotice {
    return new UpcomingRenewalNotice(SubscriptionId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      expiresAt: primitives.expiresAt,
      isCurrentChain: primitives.isCurrentChain,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get expiresAt(): Temporal.Instant {
    return this.props.expiresAt;
  }

  /** Play에서 요금제를 바꿔 원래 만료까지 남은 옛 체인은 다음 결제를 정하지 않아 알리지 않는다. */
  isNoticeable(): boolean {
    return this.props.isCurrentChain;
  }

  toPrimitives(): UpcomingRenewalNoticePrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      expiresAt: this.props.expiresAt,
      isCurrentChain: this.props.isCurrentChain,
    };
  }
}
