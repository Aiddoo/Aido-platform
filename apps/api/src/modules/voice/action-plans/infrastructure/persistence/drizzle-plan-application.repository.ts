import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { lt } from "drizzle-orm";

import {
  databaseConstraint,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { planApplication as planApplicationTable } from "#api/platform/database/schema/voice.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { planApplicationInProgress } from "../../application/action-plans.errors.js";
import { PlanApplicationRepositoryPort } from "../../application/ports/plan-application.repository.port.js";
import type { PlanApplication } from "../../domain/plan-application.aggregate.js";
import { toPlanApplication, toPlanApplicationRow } from "./plan-application-row.mapper.js";

const IDEMPOTENCY_KEY_CONSTRAINT = "PlanApplication_userId_idempotencyKey_key";

@Injectable()
export class DrizzlePlanApplicationRepository implements PlanApplicationRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
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
    try {
      await this.#db
        .insert(planApplicationTable)
        .values(toPlanApplicationRow(application))
        .onConflictDoNothing({ target: planApplicationTable.id });
    } catch (error) {
      if (
        isUniqueConstraintViolation(error) &&
        databaseConstraint(error) === IDEMPOTENCY_KEY_CONSTRAINT
      ) {
        throw planApplicationInProgress();
      }
      throw error;
    }
  }

  async purgeCreatedBefore(cutoff: Temporal.Instant): Promise<number> {
    const purged = await this.#db
      .delete(planApplicationTable)
      .where(lt(planApplicationTable.createdAt, cutoff))
      .returning({ id: planApplicationTable.id });
    return purged.length;
  }
}
