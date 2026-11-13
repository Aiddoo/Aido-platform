import {
  PREMIUM_TRIAL_ENDING_NOTICE_DAYS,
  type SubscriptionPlanType,
  type SubscriptionStatus,
} from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import { isBillingNoticeable } from "../../shared/domain/billing-notice-window.domain-service.js";
import { planTypeOfProduct } from "../../shared/domain/subscription-plan.domain-service.js";
import { SubscriptionId } from "./subscription-id.vo.js";

type Instant = Temporal.Instant;

export interface TrialEndingNoticePrimitives {
  readonly id: number;
  readonly userId: string;
  readonly status: SubscriptionStatus;
  readonly productId: string;
  readonly startedAt: Instant;
  readonly expiresAt: Instant;
}

interface TrialEndingNoticeProps {
  readonly userId: UserId;
  readonly status: SubscriptionStatus;
  readonly productId: string;
  readonly startedAt: Instant;
  readonly expiresAt: Instant;
}

/**
 * 끝나기 전에 한 번 알릴 무료 체험 구독(작업 원장 행). 보냈다는 표시는 저장소의 조건부 묶음 갱신(claim)이
 * 남긴다.
 */
export class TrialEndingNotice extends Entity<SubscriptionId, TrialEndingNoticeProps> {
  static reconstitute(primitives: TrialEndingNoticePrimitives): TrialEndingNotice {
    return new TrialEndingNotice(SubscriptionId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      status: primitives.status,
      productId: primitives.productId,
      startedAt: primitives.startedAt,
      expiresAt: primitives.expiresAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get expiresAt(): Instant {
    return this.props.expiresAt;
  }

  /** 해지하지 않아 체험이 끝나면 결제가 이어지는지 */
  get willRenew(): boolean {
    return this.props.status === "ACTIVE";
  }

  /** 체험 뒤 이어질 요금제. 모르는 상품이면 null이다. */
  get planType(): SubscriptionPlanType | null {
    return planTypeOfProduct(this.props.productId);
  }

  /** 시작할 때 이미 안내 기간 안이었던 체험(재설치·짧은 체험)은 시작 직후 알림이 되므로 보내지 않는다. */
  isNoticeable(): boolean {
    return isBillingNoticeable(
      this.props.startedAt,
      this.props.expiresAt,
      PREMIUM_TRIAL_ENDING_NOTICE_DAYS,
    );
  }

  toPrimitives(): TrialEndingNoticePrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      status: this.props.status,
      productId: this.props.productId,
      startedAt: this.props.startedAt,
      expiresAt: this.props.expiresAt,
    };
  }
}
