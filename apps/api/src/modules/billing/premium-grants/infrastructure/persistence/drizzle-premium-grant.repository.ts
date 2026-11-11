import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, exists, gt, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { validStoreEntitlementCondition } from "#api/modules/access/entitlements/access-entitlements.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { premiumGrant, subscription } from "#api/platform/database/schema/billing.schema";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import {
  type ListPremiumGrantUsersToReconcileParams,
  PremiumGrantRepositoryPort,
} from "../../application/ports/premium-grant.repository.port.js";
import { PremiumGrantId } from "../../domain/premium-grant-id.vo.js";
import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import { toPremiumGrant, toPremiumGrantRow } from "./premium-grant-row.mapper.js";

const grantOf = alias(premiumGrant, "grant");
const currentOf = alias(premiumGrant, "current");
const storeOf = alias(subscription, "store");

@Injectable()
export class DrizzlePremiumGrantRepository extends PremiumGrantRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  // 보상 기간 사용자가 소유한 스토어 행이다. 최종 판단은 resolvePremiumAccess가 같은 규칙으로 다시 한다
  #storeOfGrantUser() {
    return and(eq(storeOf.userId, grantOf.userId), isNull(storeOf.deletedAt));
  }

  // isStoreEntitlementValid와 같은 조건(웹훅 대기 유예·결제 유예 포함). 규칙은 billing shared가 소유한다
  #validStoreOfGrantUser(at: Temporal.Instant) {
    return this.#db
      .select({ one: sql`1` })
      .from(storeOf)
      .where(
        and(this.#storeOfGrantUser(), validStoreEntitlementCondition(storeOf, instantToDate(at))),
      );
  }

  async nextId(): Promise<PremiumGrantId> {
    return PremiumGrantId.reconstitute(createEntityId());
  }

  async listOpenByUserId(userId: UserId): Promise<PremiumGrant[]> {
    const rows = await this.#db.query.premiumGrant.findMany({
      where: { userId: userId.value, status: { in: ["BANKED", "ACTIVE"] } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPremiumGrant);
  }

  async findBySourceKey(sourceKey: string): Promise<PremiumGrant | null> {
    const row = await this.#db.query.premiumGrant.findFirst({ where: { sourceKey } });
    return row == null ? null : toPremiumGrant(row);
  }

  async findLastEndedAt(userId: UserId): Promise<Temporal.Instant | null> {
    const row = await this.#db.query.premiumGrant.findFirst({
      columns: { endsAt: true },
      where: { userId: userId.value, status: "ENDED", endsAt: { isNotNull: true } },
      orderBy: { endsAt: "desc" },
    });
    return row?.endsAt ?? null;
  }

  async saveIfAbsent(grant: PremiumGrant): Promise<boolean> {
    const inserted = await this.#db
      .insert(premiumGrant)
      .values(toPremiumGrantRow(grant))
      .onConflictDoNothing({ target: premiumGrant.sourceKey })
      .returning({ id: premiumGrant.id });
    return inserted.length === 1;
  }

  async saveAll(grants: readonly PremiumGrant[]): Promise<void> {
    if (grants.length === 0) {
      return;
    }
    // 행마다 다른 기간은 UPDATE … FROM (VALUES …) 한 문장으로 바꾼다
    const values = grants.map((grant) => {
      const { id, status, startsAt, endsAt, updatedAt } = grant.toPrimitives();
      return sql`(${id}, ${status}, ${sql.param(startsAt, premiumGrant.startsAt)}::timestamp(3), ${sql.param(endsAt, premiumGrant.endsAt)}::timestamp(3), ${sql.param(updatedAt, premiumGrant.updatedAt)}::timestamp(3))`;
    });
    await this.#db.execute(sql`
      UPDATE ${premiumGrant}
      SET ${sql.identifier(premiumGrant.status.name)} = changed."status"::"PremiumGrantStatus",
          ${sql.identifier(premiumGrant.startsAt.name)} = changed."startsAt",
          ${sql.identifier(premiumGrant.endsAt.name)} = changed."endsAt",
          ${sql.identifier(premiumGrant.updatedAt.name)} = changed."updatedAt"
      FROM (VALUES ${sql.join(values, sql`, `)}) AS changed("id", "status", "startsAt", "endsAt", "updatedAt")
      WHERE ${premiumGrant.id} = changed."id"
    `);
  }

  async listUserIdsToReconcile(params: ListPremiumGrantUsersToReconcileParams): Promise<UserId[]> {
    // planPremiumReconciliation이 바꿀 것이 있는 사용자만 고른다(끝낼 기간, 시작할 기간,
    // 스토어가 유효해 다시 쌓거나 끊을 기간). 정책보다 넓게 고르면 같은 사용자를 실행마다 헛되이 다시 잠근다.
    const rows = await this.#db
      .selectDistinct({ userId: grantOf.userId })
      .from(grantOf)
      .where(
        and(
          or(
            and(eq(grantOf.status, "ACTIVE"), lte(grantOf.endsAt, params.now)),
            and(
              eq(grantOf.status, "BANKED"),
              notExists(this.#validStoreOfGrantUser(params.now)),
              notExists(
                this.#db
                  .select({ one: sql`1` })
                  .from(currentOf)
                  .where(
                    and(
                      eq(currentOf.userId, grantOf.userId),
                      eq(currentOf.status, "ACTIVE"),
                      gt(currentOf.endsAt, params.now),
                    ),
                  ),
              ),
            ),
            and(
              eq(grantOf.status, "ACTIVE"),
              gt(grantOf.endsAt, params.now),
              exists(this.#validStoreOfGrantUser(params.now)),
            ),
          ),
          params.afterUserId == null ? undefined : gt(grantOf.userId, params.afterUserId.value),
        ),
      )
      .orderBy(grantOf.userId)
      .limit(params.limit);
    return rows.map((row) => UserId.reconstitute(row.userId));
  }
}
