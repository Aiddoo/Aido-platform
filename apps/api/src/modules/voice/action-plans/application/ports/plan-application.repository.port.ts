import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PlanApplication } from "../../domain/plan-application.aggregate.js";

export abstract class PlanApplicationRepositoryPort {
  abstract findByIdempotencyKey(
    userId: UserId,
    idempotencyKey: string,
  ): Promise<PlanApplication | null>;
  abstract save(application: PlanApplication): Promise<void>;
  /** cutoff 전에 만든 기록을 지우고 지운 수를 돌려준다 */
  abstract deleteCreatedBefore(cutoff: Temporal.Instant): Promise<number>;
}
