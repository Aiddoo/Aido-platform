import { BROADCAST_TARGET_FILTER, type BroadcastTargetFilter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, exists, gt, gte, inArray, isNull, type SQL } from "drizzle-orm";
import { match } from "ts-pattern";

import { activeSubscriptionCondition } from "#api/modules/access/access-entitlement-sql.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushToken, user } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { AdminUserDirectoryReaderPort } from "../../application/ports/admin-user-directory.reader.port.js";

@Injectable()
export class DrizzleAdminUserDirectoryReader extends AdminUserDirectoryReaderPort {
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

  async listTargetUserIdsAfter(params: {
    readonly filter: BroadcastTargetFilter;
    readonly cursorUserId: UserId | null;
    readonly limit: number;
  }): Promise<UserId[]> {
    const { filter, cursorUserId, limit } = params;
    const rows = await this.#db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          this.#targetCondition(filter),
          cursorUserId == null ? undefined : gt(user.id, cursorUserId.value),
        ),
      )
      .orderBy(asc(user.id))
      .limit(limit);
    return rows.map((row) => UserId.reconstitute(row.id));
  }

  countTargets(filter: BroadcastTargetFilter): Promise<number> {
    return this.#db.$count(user, this.#targetCondition(filter));
  }

  async listExistingUserIds(userIds: readonly UserId[]): Promise<UserId[]> {
    const rows = await this.#db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          inArray(
            user.id,
            userIds.map((userId) => userId.value),
          ),
          isNull(user.deletedAt),
        ),
      );
    return rows.map((row) => UserId.reconstitute(row.id));
  }

  #targetCondition(filter: BroadcastTargetFilter): SQL | undefined {
    const now = this.#clock.now();
    const activeSince = (days: number) => now.subtract({ hours: days * 24 });
    return and(
      isNull(user.deletedAt),
      eq(user.status, "ACTIVE"),
      match(filter)
        .with(BROADCAST_TARGET_FILTER.ALL, () => undefined)
        .with(BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN, () =>
          exists(
            this.#db
              .select({ id: pushToken.id })
              .from(pushToken)
              .where(eq(pushToken.userId, user.id)),
          ),
        )
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS, () =>
          gte(user.lastLoginAt, activeSince(7)),
        )
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS, () =>
          gte(user.lastLoginAt, activeSince(30)),
        )
        // User projection이 보상 기간도 ACTIVE로 쓰므로 "구독자"에는 초대 보상으로 프리미엄인 사용자도 들어간다
        .with(BROADCAST_TARGET_FILTER.SUBSCRIBERS, () =>
          activeSubscriptionCondition(user, instantToDate(now)),
        )
        .exhaustive(),
    );
  }
}
