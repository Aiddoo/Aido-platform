import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, exists, gt, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { validStoreEntitlementCondition } from "#api/modules/access/access-entitlement-sql.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { premiumGrant, subscription } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  FindPremiumGrantUsersToReconcileParams,
  PremiumGrantRepositoryPort,
} from "../../application/ports/premium-grant.repository.port.js";
import {
  PremiumGrant,
  type PremiumGrantCreationPlan,
} from "../../domain/premium-grant.aggregate.js";

const grantOf = alias(premiumGrant, "grant");
const currentOf = alias(premiumGrant, "current");
const storeOf = alias(subscription, "store");

@Injectable()
export class DrizzlePremiumGrantRepository implements PremiumGrantRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  // 보상 기간 사용자가 소유한 스토어 행이다. 최종 판단은 PremiumAccessPolicy가 같은 규칙으로 다시 한다
  #storeOfGrantUser() {
    return and(eq(storeOf.userId, grantOf.userId), isNull(storeOf.deletedAt));
  }

  // isStoreEntitlementValid와 같은 조건(웹훅 대기 유예·결제 유예 포함). 규칙은 Access가 소유한다
  #validStoreOfGrantUser(at: Date) {
    return this.#db
      .select({ one: sql`1` })
      .from(storeOf)
      .where(and(this.#storeOfGrantUser(), validStoreEntitlementCondition(storeOf, at)));
  }

  async findOpenByUserId(userId: string): Promise<PremiumGrant[]> {
    const rows = await this.#db.query.premiumGrant.findMany({
      columns: {
        id: true,
        userId: true,
        source: true,
        sourceKey: true,
        durationDays: true,
        durationMs: true,
        status: true,
        startsAt: true,
        endsAt: true,
        endingNotifiedAt: true,
        createdAt: true,
      },
      where: { userId, status: { in: ["BANKED", "ACTIVE"] } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => PremiumGrant.reconstitute(row));
  }

  async findBySourceKey(sourceKey: string): Promise<PremiumGrant | null> {
    const row = await this.#db.query.premiumGrant.findFirst({
      columns: {
        id: true,
        userId: true,
        source: true,
        sourceKey: true,
        durationDays: true,
        durationMs: true,
        status: true,
        startsAt: true,
        endsAt: true,
        endingNotifiedAt: true,
        createdAt: true,
      },
      where: { sourceKey },
    });
    return row == null ? null : PremiumGrant.reconstitute(row);
  }

  async findLastEndedAt(userId: string): Promise<Date | null> {
    const row = await this.#db.query.premiumGrant.findFirst({
      columns: { endsAt: true },
      where: { userId, status: "ENDED", endsAt: { isNotNull: true } },
      orderBy: { endsAt: "desc" },
    });
    return row?.endsAt ?? null;
  }

  async create(plan: PremiumGrantCreationPlan): Promise<boolean> {
    const inserted = await this.#db
      .insert(premiumGrant)
      .values(plan)
      .onConflictDoNothing({ target: premiumGrant.sourceKey })
      .returning({ id: premiumGrant.id });
    return inserted.length === 1;
  }

  async saveAll(grants: readonly PremiumGrant[]): Promise<void> {
    if (grants.length === 0) {
      return;
    }
    const updatedAt = now();
    // 행마다 다른 기간은 UPDATE … FROM (VALUES …) 한 문장으로 바꾼다
    const values = grants.map((grant) => {
      const state = grant.toPersistence();
      return sql`(${grant.id}, ${state.status}, ${sql.param(state.startsAt, premiumGrant.startsAt)}::timestamp(3), ${sql.param(state.endsAt, premiumGrant.endsAt)}::timestamp(3))`;
    });
    await this.#db.execute(sql`
      UPDATE ${premiumGrant}
      SET ${sql.identifier(premiumGrant.status.name)} = changed."status"::"PremiumGrantStatus",
          ${sql.identifier(premiumGrant.startsAt.name)} = changed."startsAt",
          ${sql.identifier(premiumGrant.endsAt.name)} = changed."endsAt",
          ${sql.identifier(premiumGrant.updatedAt.name)} = ${sql.param(updatedAt, premiumGrant.updatedAt)}
      FROM (VALUES ${sql.join(values, sql`, `)}) AS changed("id", "status", "startsAt", "endsAt")
      WHERE ${premiumGrant.id} = changed."id"
    `);
  }

  async findUserIdsToReconcile(params: FindPremiumGrantUsersToReconcileParams): Promise<string[]> {
    // PremiumAccessPolicy.planReconciliation이 바꿀 것이 있는 사용자만 고른다(끝낼 기간, 시작할 기간,
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
          params.afterUserId == null ? undefined : gt(grantOf.userId, params.afterUserId),
        ),
      )
      .orderBy(grantOf.userId)
      .limit(params.limit);
    return rows.map((row) => row.userId);
  }
}
