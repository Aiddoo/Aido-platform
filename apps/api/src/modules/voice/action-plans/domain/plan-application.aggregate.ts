import type { ActionPlanSource } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { PlanApplicationId } from "./plan-application-id.vo.js";

export interface PlanApplicationPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly source: ActionPlanSource;
  readonly todoIds: readonly number[];
  readonly memoId: number | null;
  readonly createdAt: Temporal.Instant;
}

interface PlanApplicationProps {
  readonly userId: UserId;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly source: ActionPlanSource;
  readonly todoIds: readonly number[];
  readonly memoId: number | null;
  readonly createdAt: Temporal.Instant;
}

interface CreatePlanApplicationParams {
  readonly userId: UserId;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly source: ActionPlanSource;
  readonly todoIds: readonly number[];
  readonly memoId: number | null;
  readonly now: Temporal.Instant;
}

/**
 * 계획 적용 한 번의 멱등 기록. 사용자 글자는 두지 않고 만든 id와 요청 해시만 둔다. 만든 뒤 바뀌지 않고
 * 할 일·메모는 그 뒤 지워질 수 있어 id만 가리킨다.
 */
export class PlanApplication extends AggregateRoot<PlanApplicationId, PlanApplicationProps> {
  static create(params: CreatePlanApplicationParams): PlanApplication {
    return new PlanApplication(PlanApplicationId.generate(), {
      userId: params.userId,
      idempotencyKey: params.idempotencyKey,
      requestHash: params.requestHash,
      source: params.source,
      todoIds: [...params.todoIds],
      memoId: params.memoId,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: PlanApplicationPrimitives): PlanApplication {
    return new PlanApplication(PlanApplicationId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      idempotencyKey: primitives.idempotencyKey,
      requestHash: primitives.requestHash,
      source: primitives.source,
      todoIds: [...primitives.todoIds],
      memoId: primitives.memoId,
      createdAt: primitives.createdAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get todoIds(): readonly number[] {
    return this.props.todoIds;
  }

  get memoId(): number | null {
    return this.props.memoId;
  }

  /** 같은 Idempotency-Key로 다시 보낸 적용이 처음과 같은 계획인지 */
  isSameRequest(requestHash: string): boolean {
    return this.props.requestHash === requestHash;
  }

  toPrimitives(): PlanApplicationPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      idempotencyKey: this.props.idempotencyKey,
      requestHash: this.props.requestHash,
      source: this.props.source,
      todoIds: [...this.props.todoIds],
      memoId: this.props.memoId,
      createdAt: this.props.createdAt,
    };
  }
}
