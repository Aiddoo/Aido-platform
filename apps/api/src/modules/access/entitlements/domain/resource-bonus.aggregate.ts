import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { BonusResource } from "./entitlements.constants.js";
import { ResourceBonusId } from "./resource-bonus-id.vo.js";

export interface ResourceBonusPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly resource: BonusResource;
  readonly quantity: number;
  readonly sourceKey: string;
  readonly createdAt: Temporal.Instant;
}

interface ResourceBonusProps {
  readonly userId: UserId;
  readonly resource: BonusResource;
  readonly quantity: number;
  /** 같은 보상을 두 번 지급하지 않게 하는 출처 키. 저장소가 같은 키를 한 번만 받는다 */
  readonly sourceKey: string;
  readonly createdAt: Temporal.Instant;
}

/** 초대 보상 등으로 받은 리소스 자리. 한 번 지급하면 바뀌지 않고 합계가 그 리소스의 보너스다. */
export class ResourceBonus extends AggregateRoot<ResourceBonusId, ResourceBonusProps> {
  static create(params: {
    readonly id: ResourceBonusId;
    readonly userId: UserId;
    readonly resource: BonusResource;
    readonly quantity: number;
    readonly sourceKey: string;
    readonly now: Temporal.Instant;
  }): ResourceBonus {
    return new ResourceBonus(params.id, {
      userId: params.userId,
      resource: params.resource,
      quantity: params.quantity,
      sourceKey: params.sourceKey,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: ResourceBonusPrimitives): ResourceBonus {
    return new ResourceBonus(ResourceBonusId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      resource: primitives.resource,
      quantity: primitives.quantity,
      sourceKey: primitives.sourceKey,
      createdAt: primitives.createdAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  toPrimitives(): ResourceBonusPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      resource: this.props.resource,
      quantity: this.props.quantity,
      sourceKey: this.props.sourceKey,
      createdAt: this.props.createdAt,
    };
  }
}
