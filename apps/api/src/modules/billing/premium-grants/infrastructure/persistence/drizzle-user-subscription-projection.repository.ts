import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, not } from "drizzle-orm";

import { activeSubscriptionCondition } from "#api/modules/access/access-entitlement-sql.public";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import {
  type ListLapsedPremiumUsersParams,
  type UserSubscriptionProjection,
  UserSubscriptionProjectionRepositoryPort,
} from "../../application/ports/user-subscription-projection.repository.port.js";

@Injectable()
export class DrizzleUserSubscriptionProjectionRepository extends UserSubscriptionProjectionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    super();
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async update(userId: UserId, projection: UserSubscriptionProjection): Promise<void> {
    const updated = await this.#db
      .update(user)
      .set({
        subscriptionStatus: projection.subscriptionStatus,
        subscriptionExpiresAt: projection.subscriptionExpiresAt,
        updatedAt: this.#clock.now(),
      })
      .where(eq(user.id, userId.value))
      .returning({ id: user.id });
    if (updated.length === 0) {
      throw new DatabaseRecordNotFoundError();
    }
  }

  async listLapsedPremiumUserIds(params: ListLapsedPremiumUsersParams): Promise<UserId[]> {
    const rows = await this.#db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.subscriptionStatus, "ACTIVE"),
          isNull(user.deletedAt),
          not(activeSubscriptionCondition(user, instantToDate(params.now))),
          params.afterUserId == null ? undefined : gt(user.id, params.afterUserId.value),
        ),
      )
      .orderBy(user.id)
      .limit(params.limit);
    return rows.map((row) => UserId.reconstitute(row.id));
  }
}
