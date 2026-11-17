import { BROADCAST_TARGET_FILTER, type BroadcastTargetFilter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, gt, inArray } from "drizzle-orm";
import { match } from "ts-pattern";

import { activeSubscriptionCondition } from "#api/modules/access/feature-grants/access-feature-grants-queries.public";
import {
  userAudience,
  type UserAudience,
  type UserAudienceFilter,
} from "#api/modules/identity/users/identity-users.public";
import { hasPushTokenCondition } from "#api/modules/notification/push-devices/notification-push-devices.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { AdminUserDirectoryReaderPort } from "../../application/ports/admin-user-directory.reader.port.js";

// 분배 페이지가 한 문장이 되도록 사용자 칸·조건은 identity, 토큰은 notification, 구독은 access 조각을 붙인다
@Injectable()
export class DrizzleAdminUserDirectoryReader extends AdminUserDirectoryReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    super();
    this.#transactionHost = transactionHost;
    this.#clock = clock;
  }

  async listTargetUserIdsAfter(params: {
    readonly filter: BroadcastTargetFilter;
    readonly cursorUserId: UserId | null;
    readonly limit: number;
  }): Promise<UserId[]> {
    const { filter, cursorUserId, limit } = params;
    const audience = this.#targetAudience(filter);
    const rows = await this.#db
      .select({ id: audience.userId })
      .from(audience.table)
      .where(
        and(
          audience.condition,
          cursorUserId == null ? undefined : gt(audience.userId, cursorUserId.value),
        ),
      )
      .orderBy(asc(audience.userId))
      .limit(limit);
    return rows.map((row) => UserId.reconstitute(row.id));
  }

  countTargets(filter: BroadcastTargetFilter): Promise<number> {
    const audience = this.#targetAudience(filter);
    return this.#db.$count(audience.table, audience.condition);
  }

  async listExistingUserIds(userIds: readonly UserId[]): Promise<UserId[]> {
    const audience = userAudience({ activeOnly: false, lastLoginSince: null, refine: null });
    const rows = await this.#db
      .select({ id: audience.userId })
      .from(audience.table)
      .where(
        and(
          inArray(
            audience.userId,
            userIds.map((userId) => userId.value),
          ),
          audience.condition,
        ),
      );
    return rows.map((row) => UserId.reconstitute(row.id));
  }

  #targetAudience(filter: BroadcastTargetFilter): UserAudience {
    const now = this.#clock.now();
    const activeSince = (days: number) => now.subtract({ hours: days * 24 });
    const activeUsers = (narrowing: Partial<UserAudienceFilter>) =>
      userAudience({ activeOnly: true, lastLoginSince: null, refine: null, ...narrowing });
    return (
      match(filter)
        .with(BROADCAST_TARGET_FILTER.ALL, () => activeUsers({}))
        .with(BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN, () =>
          activeUsers({ refine: (target) => hasPushTokenCondition(target.id) }),
        )
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS, () =>
          activeUsers({ lastLoginSince: activeSince(7) }),
        )
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS, () =>
          activeUsers({ lastLoginSince: activeSince(30) }),
        )
        // User projection이 보상 기간도 ACTIVE로 쓰므로 "구독자"에는 초대 보상으로 프리미엄인 사용자도 들어간다
        .with(BROADCAST_TARGET_FILTER.SUBSCRIBERS, () =>
          activeUsers({
            refine: (target) => activeSubscriptionCondition(target, instantToDate(now)),
          }),
        )
        .exhaustive()
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
