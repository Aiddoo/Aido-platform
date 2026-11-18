import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PlanApplication } from "../../domain/plan-application.aggregate.js";

export abstract class PlanApplicationRepositoryPort {
  abstract findByIdempotencyKey(
    userId: UserId,
    idempotencyKey: string,
  ): Promise<PlanApplication | null>;
  /** 같은 사용자의 같은 Idempotency-Key를 가진 다른 기록이 있으면 처리 중(AI_1314)으로 거절한다 */
  abstract save(application: PlanApplication): Promise<void>;
  /** 보존 기간이 지난 기록을 한 문장으로 지우고 지운 수를 돌려준다 */
  abstract purgeCreatedBefore(cutoff: Temporal.Instant): Promise<number>;
}
