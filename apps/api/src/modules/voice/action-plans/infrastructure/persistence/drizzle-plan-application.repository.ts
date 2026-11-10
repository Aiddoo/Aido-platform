import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, lt } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { planApplication } from "#api/platform/database/schema/index";

import type {
  PlanApplicationRecord,
  PlanApplicationRepositoryPort,
} from "../../application/ports/plan-application.repository.port.js";

@Injectable()
export class DrizzlePlanApplicationRepository implements PlanApplicationRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async findByKey(userId: string, idempotencyKey: string): Promise<PlanApplicationRecord | null> {
    const [row] = await this.#txHost.tx
      .select()
      .from(planApplication)
      .where(
        and(eq(planApplication.userId, userId), eq(planApplication.idempotencyKey, idempotencyKey)),
      );
    return row ?? null;
  }

  async insert(record: PlanApplicationRecord): Promise<void> {
    await this.#txHost.tx
      .insert(planApplication)
      .values({ ...record, todoIds: [...record.todoIds] });
  }

  async deleteCreatedBefore(cutoff: Date): Promise<number> {
    const deleted = await this.#txHost.tx
      .delete(planApplication)
      .where(lt(planApplication.createdAt, cutoff))
      .returning({ id: planApplication.id });
    return deleted.length;
  }
}
