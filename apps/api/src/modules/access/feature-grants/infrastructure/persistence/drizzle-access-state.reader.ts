import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, sum } from "drizzle-orm";

import { storeEntitlementWindows } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { userAccessSubjects } from "#api/modules/identity/users/identity-users-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { featureGrant } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FeatureGrants } from "../../../shared/domain/access.constants.js";
import type { AccessState } from "../../../shared/domain/entitlement.domain-service.js";
import { resolvePaidAccessDeadline } from "../../../shared/domain/paid-access.domain-service.js";
import type { AccessStateReaderPort } from "../../application/ports/access-state.reader.port.js";

/** 권한 판단 조회는 호출자의 CLS 트랜잭션에 참여한다. */
@Injectable()
export class DrizzleAccessStateReader implements AccessStateReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findActiveUserAccessState(userId: UserId): Promise<AccessState | null> {
    return this.#findAccessState(userId, { activeOnly: true });
  }

  async findAccessState(userId: UserId): Promise<AccessState | null> {
    return this.#findAccessState(userId, { activeOnly: false });
  }

  async sumFeatureGrants(userId: UserId): Promise<FeatureGrants> {
    // 지급은 1 이상만 저장하지만 손으로 넣은 0·음수 행이 한도를 줄이지 않게 더하지 않는다
    const groups = await this.#db
      .select({ feature: featureGrant.resource, quantity: sum(featureGrant.quantity) })
      .from(featureGrant)
      .where(and(eq(featureGrant.userId, userId.value), gt(featureGrant.quantity, 0)))
      .groupBy(featureGrant.resource);
    return Object.fromEntries(
      groups.flatMap(({ feature, quantity }) =>
        quantity == null ? [] : [[feature, Number(quantity)] as const],
      ),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  // 스토어 유예(웹훅 대기·결제 유예)는 행에서만 알 수 있어 같은 조회에 옮겨 가지 않은 구독 행을 붙인다
  async #findAccessState(
    userId: UserId,
    filter: { readonly activeOnly: boolean },
  ): Promise<AccessState | null> {
    const subject = userAccessSubjects(filter);
    const store = storeEntitlementWindows();
    const rows = await this.#db
      .select({
        role: subject.role,
        subscriptionStatus: subject.subscriptionStatus,
        subscriptionExpiresAt: subject.subscriptionExpiresAt,
        store: {
          status: store.status,
          expiresAt: store.expiresAt,
          gracePeriodEndsAt: store.gracePeriodEndsAt,
        },
      })
      .from(subject)
      .leftJoin(store, eq(store.userId, subject.id))
      .where(eq(subject.id, userId.value));
    return toAccessState(rows);
  }
}

interface AccessStateRow {
  readonly role: AccessState["role"];
  readonly subscriptionStatus: AccessState["subscriptionStatus"];
  readonly subscriptionExpiresAt: Temporal.Instant | null;
  readonly store: {
    readonly status: string;
    readonly expiresAt: Temporal.Instant;
    readonly gracePeriodEndsAt: Temporal.Instant | null;
  } | null;
}

// 사용자 행마다 옮겨 가지 않은 구독 행이 하나씩 붙는다. 구독이 없으면 store가 null인 한 행이다
function toAccessState(rows: readonly AccessStateRow[]): AccessState | null {
  const [first] = rows;
  if (first == null) {
    return null;
  }
  return {
    role: first.role,
    subscriptionStatus: first.subscriptionStatus,
    accessDeadline: resolvePaidAccessDeadline({
      subscriptionExpiresAt: first.subscriptionExpiresAt,
      storeEntitlements: rows.flatMap((row) => (row.store == null ? [] : [row.store])),
    }),
  };
}
