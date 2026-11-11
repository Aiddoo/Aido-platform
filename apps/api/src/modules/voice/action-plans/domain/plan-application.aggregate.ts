import type { ActionPlanSource } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { PlanApplicationId } from "./plan-application-id.vo.js";
import { PLAN_APPLICATION_RETENTION_DAYS } from "./plan-application.constants.js";

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

type PlanApplicationProps = Omit<PlanApplicationPrimitives, "id" | "userId"> & {
  readonly userId: UserId;
};

/**
 * 계획 적용 한 번의 멱등 기록. 사용자 글자는 두지 않고 만든 id와 요청 해시만 둔다.
 * 같은 키로 같은 요청이 다시 오면 처음 결과를 돌려주고, 내용이 다르면 거절한다.
 */
export class PlanApplication extends AggregateRoot<PlanApplicationId, PlanApplicationProps> {
  static create(params: {
    readonly userId: UserId;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly source: ActionPlanSource;
    readonly todoIds: readonly number[];
    readonly memoId: number | null;
    readonly now: Temporal.Instant;
  }): PlanApplication {
    const { now, ...rest } = params;
    return new PlanApplication(PlanApplicationId.generate(), {
      ...rest,
      todoIds: [...rest.todoIds],
      createdAt: now,
    });
  }

  static reconstitute(primitives: PlanApplicationPrimitives): PlanApplication {
    const { id, userId, ...rest } = primitives;
    return new PlanApplication(PlanApplicationId.reconstitute(id), {
      ...rest,
      userId: UserId.reconstitute(userId),
      todoIds: [...rest.todoIds],
    });
  }

  /** 지울 수 있는 기록의 기준 시각. 앱의 재시도는 이 기간 안에 끝난다 */
  static retentionCutoff(now: Temporal.Instant): Temporal.Instant {
    return now.subtract({ hours: PLAN_APPLICATION_RETENTION_DAYS * 24 });
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

  isSameRequest(requestHash: string): boolean {
    return this.props.requestHash === requestHash;
  }

  toPrimitives(): PlanApplicationPrimitives {
    const { userId, ...rest } = this.props;
    return { ...rest, id: this.id.value, userId: userId.value, todoIds: [...rest.todoIds] };
  }
}
