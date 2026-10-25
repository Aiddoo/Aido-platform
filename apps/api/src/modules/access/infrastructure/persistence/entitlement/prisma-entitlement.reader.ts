import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { decodeRecord } from "../../../../../platform/database/database-records.js";
import type { Prisma8TransactionalAdapter } from "../../../../../platform/database/prisma8-transactional.adapter.js";
import type {
  EntitlementDatabasePort,
  EntitlementUserState,
} from "../../../application/ports/entitlement/entitlement-state.port.js";
import { resolvePremiumAccessDeadline } from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

/** Authorization reads participate in the caller's CLS transaction. */
@Injectable()
export class PrismaEntitlementReader implements EntitlementDatabasePort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async findUserState(userId: string): Promise<EntitlementUserState | null> {
    // 자동 갱신 구독의 유예 시간은 행에서만 알 수 있어 같은 조회에 옮겨 가지 않은 ACTIVE 행을 붙인다
    const user = decodeRecord(
      "User",
      await this.txHost.tx.orm.public.User.where({
        id: userId,
        status: "ACTIVE",
        deletedAt: null,
      })
        .select("role", "subscriptionStatus", "subscriptionExpiresAt")
        .include("subscriptions", (related) =>
          related.where({ status: "ACTIVE", deletedAt: null }).select("expiresAt"),
        )
        .first(),
    );
    if (user == null) return null;
    return {
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      accessDeadline: resolvePremiumAccessDeadline({
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        renewingStoreExpiresAt: user.subscriptions.map((subscription) => subscription.expiresAt),
      }),
    };
  }
}
