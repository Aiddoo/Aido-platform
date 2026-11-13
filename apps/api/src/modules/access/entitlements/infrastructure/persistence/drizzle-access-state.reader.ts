import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, sum } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { resourceBonus } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FeatureGrants } from "../../../shared/domain/access.constants.js";
import type { AccessState } from "../../../shared/domain/entitlement.domain-service.js";
import { resolvePaidAccessDeadline } from "../../../shared/domain/paid-access.domain-service.js";
import { AccessStateReaderPort } from "../../application/ports/access-state.reader.port.js";

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

  async findFeatureGrants(userId: UserId): Promise<FeatureGrants> {
    // 지급은 1 이상만 저장하지만 손으로 넣은 0·음수 행이 한도를 줄이지 않게 더하지 않는다
    const groups = await this.#db
      .select({ feature: resourceBonus.resource, quantity: sum(resourceBonus.quantity) })
      .from(resourceBonus)
      .where(and(eq(resourceBonus.userId, userId.value), gt(resourceBonus.quantity, 0)))
      .groupBy(resourceBonus.resource);
    return Object.fromEntries(
      groups.flatMap(({ feature, quantity }) =>
        quantity == null ? [] : [[feature, Number(quantity)] as const],
      ),
    );
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
    accessDeadline: resolvePaidAccessDeadline({
      subscriptionExpiresAt: row.subscriptionExpiresAt,
      storeEntitlements: row.subscriptions,
    }),
  };
}
