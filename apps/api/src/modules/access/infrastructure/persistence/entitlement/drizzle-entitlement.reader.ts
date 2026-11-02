import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq, sum } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { resourceBonus } from "#api/platform/database/schema/index";

import type {
  EntitlementDatabasePort,
  EntitlementUserState,
} from "../../../application/ports/entitlement/entitlement-state.port.js";
import {
  NO_RESOURCE_BONUSES,
  resolvePremiumAccessDeadline,
  type ResourceBonuses,
} from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

/** Authorization reads participate in the caller's CLS transaction. */
@Injectable()
export class DrizzleEntitlementReader implements EntitlementDatabasePort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async findUserState(userId: string): Promise<EntitlementUserState | null> {
    // 스토어 유예(웹훅 대기·결제 유예)는 행에서만 알 수 있어 같은 조회에 옮겨 가지 않은 행을 붙인다
    const row = await this.txHost.tx.query.user.findFirst({
      columns: { role: true, subscriptionStatus: true, subscriptionExpiresAt: true },
      where: { id: userId, status: "ACTIVE", deletedAt: { isNull: true } },
      with: {
        subscriptions: {
          columns: { status: true, expiresAt: true, gracePeriodEndsAt: true },
          where: { status: { in: ["ACTIVE", "CANCELLED"] }, deletedAt: { isNull: true } },
        },
      },
    });
    if (row == null) {
      return null;
    }
    return {
      role: row.role,
      subscriptionStatus: row.subscriptionStatus,
      accessDeadline: resolvePremiumAccessDeadline({
        subscriptionExpiresAt: row.subscriptionExpiresAt,
        storeEntitlements: row.subscriptions,
      }),
    };
  }

  async findResourceBonuses(userId: string): Promise<ResourceBonuses> {
    const groups = await this.txHost.tx
      .select({ resource: resourceBonus.resource, quantity: sum(resourceBonus.quantity) })
      .from(resourceBonus)
      .where(eq(resourceBonus.userId, userId))
      .groupBy(resourceBonus.resource);
    // DB ResourceType에는 아직 FRIEND만 있다
    const friend = groups.find((group) => group.resource === "FRIEND")?.quantity;
    return {
      ...NO_RESOURCE_BONUSES,
      FRIEND: friend == null ? 0 : Number(friend),
    };
  }
}
