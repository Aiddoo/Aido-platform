import type { RewardType } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import type { RewardGrantPlan } from "./invite-reward.domain-service.js";
import {
  INVITE_REWARD_MAX_ATTEMPTS,
  type RewardGrantStatus,
  type RewardSourceType,
} from "./invites.constants.js";
import { RewardGrantId } from "./reward-grant-id.vo.js";

export interface RewardGrantPrimitives {
  readonly id: string;
  readonly recipientId: string;
  readonly sourceType: RewardSourceType;
  readonly sourceId: string;
  readonly rewardType: RewardType;
  readonly quantity: number;
  readonly status: RewardGrantStatus;
  /** 지급 작업 첫 실행마다 센 실패 수. 큐 재시도는 세지 않는다. */
  readonly attempts: number;
  readonly createdAt: Temporal.Instant;
}

interface RewardGrantProps {
  readonly recipientId: UserId;
  readonly sourceType: RewardSourceType;
  readonly sourceId: string;
  readonly rewardType: RewardType;
  readonly quantity: number;
  readonly status: RewardGrantStatus;
  readonly attempts: number;
  readonly createdAt: Temporal.Instant;
}

interface CreateRewardGrantParams {
  readonly id: RewardGrantId;
  readonly plan: RewardGrantPlan;
  readonly now: Temporal.Instant;
}

/**
 * 보상 지급 원장 한 건. (출처, 받는 사람, 종류)마다 한 번만 저장된다. 적용·실패 표시는 같은 지급이 동시에
 * 적용되지 않도록 저장소가 조건부 갱신 한 문장으로 바꾼다.
 */
export class RewardGrant extends Entity<RewardGrantId, RewardGrantProps> {
  static create(params: CreateRewardGrantParams): RewardGrant {
    return new RewardGrant(params.id, {
      recipientId: params.plan.recipientId,
      sourceType: params.plan.sourceType,
      sourceId: params.plan.sourceId,
      rewardType: params.plan.rewardType,
      quantity: params.plan.quantity,
      status: "PENDING",
      attempts: 0,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: RewardGrantPrimitives): RewardGrant {
    return new RewardGrant(RewardGrantId.reconstitute(primitives.id), {
      recipientId: UserId.reconstitute(primitives.recipientId),
      sourceType: primitives.sourceType,
      sourceId: primitives.sourceId,
      rewardType: primitives.rewardType,
      quantity: primitives.quantity,
      status: primitives.status,
      attempts: primitives.attempts,
      createdAt: primitives.createdAt,
    });
  }

  get recipientId(): UserId {
    return this.props.recipientId;
  }

  get sourceType(): RewardSourceType {
    return this.props.sourceType;
  }

  get sourceId(): string {
    return this.props.sourceId;
  }

  get rewardType(): RewardType {
    return this.props.rewardType;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get status(): RewardGrantStatus {
    return this.props.status;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  /** 실제 혜택(보상 기간·리소스 보너스)으로 바꿀 때 쓰는 출처 키. 같은 지급은 한 번만 반영된다. */
  get benefitSourceKey(): string {
    return `reward-grant:${this.id.value}`;
  }

  isApplied(): boolean {
    return this.props.status === "APPLIED";
  }

  /** 아직 적용되지 않았고 자동 재시도를 다 쓰지 않았다. */
  isRetryable(): boolean {
    return !this.isApplied() && this.props.attempts < INVITE_REWARD_MAX_ATTEMPTS;
  }

  isFor(userId: UserId): boolean {
    return this.props.recipientId.equals(userId);
  }

  toPrimitives(): RewardGrantPrimitives {
    return {
      id: this.id.value,
      recipientId: this.props.recipientId.value,
      sourceType: this.props.sourceType,
      sourceId: this.props.sourceId,
      rewardType: this.props.rewardType,
      quantity: this.props.quantity,
      status: this.props.status,
      attempts: this.props.attempts,
      createdAt: this.props.createdAt,
    };
  }
}
