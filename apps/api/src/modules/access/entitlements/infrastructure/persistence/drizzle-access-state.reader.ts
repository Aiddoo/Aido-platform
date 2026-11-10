import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq, sum } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { resourceBonus } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AccessStateReaderPort } from "../../application/ports/access-state.reader.port.js";
import type { AccessState } from "../../domain/entitlement.domain-service.js";
import type { ResourceBonuses } from "../../domain/entitlements.constants.js";
import { resolvePremiumAccessDeadline } from "../../domain/paid-access.domain-service.js";

/** 권한 판단 조회는 호출자의 CLS 트랜잭션에 참여한다. */
@Injectable()
export class DrizzleAccessStateReader extends AccessStateReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findActiveUserAccessState(userId: UserId): Promise<AccessState | null> {
    // 스토어 유예(웹훅 대기·결제 유예)는 행에서만 알 수 있어 같은 조회에 옮겨 가지 않은 구독 행을 붙인다
    const row = await this.#db.query.user.findFirst({
      columns: { role: true, subscriptionStatus: true, subscriptionExpiresAt: true },
      with: {
        subscriptions: {
          columns: { status: true, expiresAt: true, gracePeriodEndsAt: true },
          where: { status: { in: ["ACTIVE", "CANCELLED"] }, deletedAt: { isNull: true } },
        },
      },
      where: { id: userId.value, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return row == null ? null : toAccessState(row);
  }

  async findAccessState(userId: UserId): Promise<AccessState | null> {
    const row = await this.#db.query.user.findFirst({
      columns: { role: true, subscriptionStatus: true, subscriptionExpiresAt: true },
      with: {
        subscriptions: {
          columns: { status: true, expiresAt: true, gracePeriodEndsAt: true },
          where: { status: { in: ["ACTIVE", "CANCELLED"] }, deletedAt: { isNull: true } },
        },
      },
      where: { id: userId.value },
    });
    return row == null ? null : toAccessState(row);
  }

  async findResourceBonuses(userId: UserId): Promise<ResourceBonuses> {
    const groups = await this.#db
      .select({ resource: resourceBonus.resource, quantity: sum(resourceBonus.quantity) })
      .from(resourceBonus)
      .where(eq(resourceBonus.userId, userId.value))
      .groupBy(resourceBonus.resource);
    const friend = groups.find((group) => group.resource === "FRIEND")?.quantity;
    return { FRIEND: friend == null ? 0 : Number(friend) };
  }
}

function toAccessState(row: {
  readonly role: AccessState["role"];
  readonly subscriptionStatus: AccessState["subscriptionStatus"];
  readonly subscriptionExpiresAt: Temporal.Instant | null;
  readonly subscriptions: ReadonlyArray<{
    readonly status: string;
    readonly expiresAt: Temporal.Instant;
    readonly gracePeriodEndsAt: Temporal.Instant | null;
  }>;
}): AccessState {
  return {
    role: row.role,
    subscriptionStatus: row.subscriptionStatus,
    accessDeadline: resolvePremiumAccessDeadline({
      subscriptionExpiresAt: row.subscriptionExpiresAt,
      storeEntitlements: row.subscriptions,
    }),
  };
}
