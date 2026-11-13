import type { GrantableFeature } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { invalidGrantQuantity } from "./entitlements.errors.js";
import { FeatureGrantId } from "./feature-grant-id.vo.js";

export interface FeatureGrantPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly feature: GrantableFeature;
  readonly quantity: number;
  readonly sourceKey: string;
  readonly createdAt: Temporal.Instant;
}

interface FeatureGrantProps {
  readonly userId: UserId;
  readonly feature: GrantableFeature;
  readonly quantity: number;
  /** 같은 보상을 두 번 지급하지 않게 하는 출처 키. 저장소가 같은 키를 한 번만 받는다 */
  readonly sourceKey: string;
  readonly createdAt: Temporal.Instant;
}

/**
 * 기능 한도에 더하는 자리(초대 보상 등). 한 번 지급하면 바뀌지 않고 기능별 합계를 요금제 한도에 더한다.
 * 기간이 있는 구매 충전(top-up)은 만료 시각을 더한 별도 지급으로 두고 합계에서 지난 것을 뺀다.
 */
export class FeatureGrant extends AggregateRoot<FeatureGrantId, FeatureGrantProps> {
  static create(params: {
    readonly id: FeatureGrantId;
    readonly userId: UserId;
    readonly feature: GrantableFeature;
    readonly quantity: number;
    readonly sourceKey: string;
    readonly now: Temporal.Instant;
  }): FeatureGrant {
    if (!Number.isSafeInteger(params.quantity) || params.quantity <= 0) {
      throw invalidGrantQuantity(params.feature, params.quantity);
    }
    return new FeatureGrant(params.id, {
      userId: params.userId,
      feature: params.feature,
      quantity: params.quantity,
      sourceKey: params.sourceKey,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: FeatureGrantPrimitives): FeatureGrant {
    return new FeatureGrant(FeatureGrantId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      feature: primitives.feature,
      quantity: primitives.quantity,
      sourceKey: primitives.sourceKey,
      createdAt: primitives.createdAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  toPrimitives(): FeatureGrantPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      feature: this.props.feature,
      quantity: this.props.quantity,
      sourceKey: this.props.sourceKey,
      createdAt: this.props.createdAt,
    };
  }
}
