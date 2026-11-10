import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq, sum } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { resourceBonus } from "#api/platform/database/schema/index";

import type {
  AccessStateReaderPort,
  ActiveUserAccessState,
} from "../../application/ports/access-state.reader.port.js";
import type { ResourceBonuses } from "../../domain/entitlement.domain-service.js";
import { resolvePremiumAccessDeadline } from "../../domain/paid-access.domain-service.js";

/** Authorization reads participate in the caller's CLS transaction. */
@Injectable()
export class DrizzleAccessStateReader implements AccessStateReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async findUserState(userId: string): Promise<ActiveUserAccessState | null> {
    // 스토어 유예(웹훅 대기·결제 유예)는 행에서만 알 수 있어 같은 조회에 옮겨 가지 않은 행을 붙인다
    const row = await this.#txHost.tx.query.user.findFirst({
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
    const groups = await this.#txHost.tx
      .select({ resource: resourceBonus.resource, quantity: sum(resourceBonus.quantity) })
      .from(resourceBonus)
      .where(eq(resourceBonus.userId, userId))
      .groupBy(resourceBonus.resource);
    const friend = groups.find((group) => group.resource === "FRIEND")?.quantity;
    return { FRIEND: friend == null ? 0 : Number(friend) };
  }
}
