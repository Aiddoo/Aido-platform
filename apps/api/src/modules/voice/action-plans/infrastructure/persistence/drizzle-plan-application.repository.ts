import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { lt } from "drizzle-orm";

import { isUniqueConstraintViolation } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { planApplication } from "#api/platform/database/schema/voice.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { planApplicationInProgress } from "../../application/action-plans.errors.js";
import { PlanApplicationRepositoryPort } from "../../application/ports/plan-application.repository.port.js";
import { PlanApplication } from "../../domain/plan-application.aggregate.js";

type PlanApplicationRow = typeof planApplication.$inferSelect;

function toPlanApplication(row: PlanApplicationRow): PlanApplication {
  return PlanApplication.reconstitute(row);
}

@Injectable()
export class DrizzlePlanApplicationRepository extends PlanApplicationRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByIdempotencyKey(
    userId: UserId,
    idempotencyKey: string,
  ): Promise<PlanApplication | null> {
    const row = await this.#db.query.planApplication.findFirst({
      where: { userId: userId.value, idempotencyKey },
    });
    return row == null ? null : toPlanApplication(row);
  }

  // 기록은 만든 뒤 바뀌지 않아 같은 id는 다시 쓰지 않는다
  async save(application: PlanApplication): Promise<void> {
    const row = application.toPrimitives();
    try {
      await this.#db
        .insert(planApplication)
        .values({ ...row, todoIds: [...row.todoIds] })
        .onConflictDoNothing({ target: planApplication.id });
    } catch (error) {
      // PlanApplication_userId_idempotencyKey_key: 같은 키의 다른 요청이 먼저 저장했다
      if (isUniqueConstraintViolation(error)) {
        throw planApplicationInProgress();
      }
      throw error;
    }
  }

  async deleteCreatedBefore(cutoff: Temporal.Instant): Promise<number> {
    const deleted = await this.#db
      .delete(planApplication)
      .where(lt(planApplication.createdAt, cutoff))
      .returning({ id: planApplication.id });
    return deleted.length;
  }
}
