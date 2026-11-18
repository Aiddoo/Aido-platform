import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, not } from "drizzle-orm";

import { activeSubscriptionCondition } from "#api/modules/access/feature-grants/access-feature-grants-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database.errors";
import { user } from "#api/platform/database/schema/identity.schema";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  ListLapsedPremiumUsersParams,
  UserSubscriptionProjection,
  UserSubscriptionProjectionPort,
} from "../../application/ports/user-subscription-projection.port.js";

@Injectable()
export class DrizzleUserSubscriptionProjectionAdapter implements UserSubscriptionProjectionPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
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

  get #db() {
    return this.#transactionHost.tx;
  }
}
