import { BROADCAST_TARGET_FILTER, type BroadcastTargetFilter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, exists, gt, gte, inArray, isNull, type SQL } from "drizzle-orm";
import { match } from "ts-pattern";

import { activeSubscriptionCondition } from "#api/modules/access/access-entitlement-sql.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushToken, user } from "#api/platform/database/schema/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";

import type { AdminUserDirectoryPort } from "../../../application/ports/admin/admin-user-directory.port.js";

@Injectable()
export class DrizzleAdminUserDirectoryAdapter implements AdminUserDirectoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findTargetUserIdsAfter(
    filter: BroadcastTargetFilter,
    cursorUserId: string | null,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          this.#targetCondition(filter),
          cursorUserId == null ? undefined : gt(user.id, cursorUserId),
        ),
      )
      .orderBy(asc(user.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  countTargets(filter: BroadcastTargetFilter): Promise<number> {
    return this.db.$count(user, this.#targetCondition(filter));
  }

  async findExistingUserIds(userIds: string[]): Promise<string[]> {
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.id, userIds), isNull(user.deletedAt)));
    return rows.map((row) => row.id);
  }

  #targetCondition(filter: BroadcastTargetFilter): SQL | undefined {
    return and(
      isNull(user.deletedAt),
      eq(user.status, "ACTIVE"),
      match(filter)
        .with(BROADCAST_TARGET_FILTER.ALL, () => undefined)
        .with(BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN, () =>
          exists(
            this.db
              .select({ id: pushToken.id })
              .from(pushToken)
              .where(eq(pushToken.userId, user.id)),
          ),
        )
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS, () =>
          gte(user.lastLoginAt, subtractDays(7)),
        )
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS, () =>
          gte(user.lastLoginAt, subtractDays(30)),
        )
        // User projection이 보상 기간도 ACTIVE로 쓰므로 "구독자"에는 초대 보상으로 프리미엄인 사용자도 들어간다
        .with(BROADCAST_TARGET_FILTER.SUBSCRIBERS, () => activeSubscriptionCondition(user, now()))
        .exhaustive(),
    );
  }
}
