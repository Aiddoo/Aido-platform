import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { premiumGrant, subscription } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";
import { storeRenewalCutoff } from "#api/shared/domain/store-renewal-grace";

import type {
  FindPremiumGrantEndingNoticesParams,
  FindPremiumGrantUsersToReconcileParams,
  PremiumGrantEndingNotice,
  PremiumGrantRepositoryPort,
} from "../../../application/ports/subscriptions/premium-grant.repository.port.js";
import {
  PremiumGrant,
  type PremiumGrantCreationPlan,
} from "../../../domain/aggregates/subscriptions/premium-grant.aggregate.js";

const grantOf = alias(premiumGrant, "grant");
const currentOf = alias(premiumGrant, "current");
const nextOf = alias(premiumGrant, "next");
const storeOf = alias(subscription, "store");

function timestampText(value: Date | null) {
  return value == null ? null : value.toISOString();
}

@Injectable()
export class DrizzlePremiumGrantRepository implements PremiumGrantRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  // 보상 기간 사용자가 소유한 스토어 행이다. 최종 판단은 PremiumAccessPolicy가 같은 규칙으로 다시 한다
  private storeOfGrantUser() {
    return and(eq(storeOf.userId, grantOf.userId), isNull(storeOf.deletedAt));
  }

  // isStoreEntitlementValid와 같은 조건: 자동 갱신 중이면 만료 뒤 유예 시간까지, 취소했으면 만료 전까지 유효하다
  private validStoreOfGrantUser(at: Date) {
    return this.db
      .select({ one: sql`1` })
      .from(storeOf)
      .where(
        and(
          this.storeOfGrantUser(),
          or(
            and(eq(storeOf.status, "ACTIVE"), gt(storeOf.expiresAt, storeRenewalCutoff(at))),
            and(eq(storeOf.status, "CANCELLED"), gt(storeOf.expiresAt, at)),
          ),
        ),
      );
  }

  async findOpenByUserId(userId: string): Promise<PremiumGrant[]> {
    const rows = await this.db.query.premiumGrant.findMany({
      columns: {
        id: true,
        userId: true,
        source: true,
        sourceKey: true,
        durationDays: true,
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

  async findLastEndedAt(userId: string): Promise<Date | null> {
    const row = await this.db.query.premiumGrant.findFirst({
      columns: { endsAt: true },
      where: { userId, status: "ENDED", endsAt: { isNotNull: true } },
      orderBy: { endsAt: "desc" },
    });
    return row?.endsAt ?? null;
  }

  async create(plan: PremiumGrantCreationPlan): Promise<boolean> {
    const inserted = await this.db
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
    const updatedAt = now().toISOString();
    // 행마다 다른 기간은 UPDATE … FROM (VALUES …) 한 문장으로 바꾼다
    const values = grants.map((grant) => {
      const state = grant.toPersistence();
      return sql`(${grant.id}, ${state.status}, ${timestampText(state.startsAt)}::timestamp(3), ${timestampText(state.endsAt)}::timestamp(3))`;
    });
    await this.db.execute(sql`
      UPDATE ${premiumGrant}
      SET ${sql.identifier(premiumGrant.status.name)} = changed."status"::"PremiumGrantStatus",
          ${sql.identifier(premiumGrant.startsAt.name)} = changed."startsAt",
          ${sql.identifier(premiumGrant.endsAt.name)} = changed."endsAt",
          ${sql.identifier(premiumGrant.updatedAt.name)} = ${updatedAt}::timestamp(3)
      FROM (VALUES ${sql.join(values, sql`, `)}) AS changed("id", "status", "startsAt", "endsAt")
      WHERE ${premiumGrant.id} = changed."id"
    `);
  }

  async findUserIdsToReconcile(params: FindPremiumGrantUsersToReconcileParams): Promise<string[]> {
    // PremiumAccessPolicy.planReconciliation이 바꿀 것이 있는 사용자만 고른다(끝낼 기간, 시작할 기간,
    // 스토어가 유효해 다시 쌓거나 끊을 기간). 정책보다 넓게 고르면 같은 사용자를 실행마다 헛되이 다시 잠근다.
    const rows = await this.db
      .selectDistinct({ userId: grantOf.userId })
      .from(grantOf)
      .where(
        and(
          or(
            and(eq(grantOf.status, "ACTIVE"), lte(grantOf.endsAt, params.now)),
            and(
              eq(grantOf.status, "BANKED"),
              notExists(this.validStoreOfGrantUser(params.now)),
              notExists(
                this.db
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
              exists(this.validStoreOfGrantUser(params.now)),
            ),
          ),
          params.afterUserId == null ? undefined : gt(grantOf.userId, params.afterUserId),
        ),
      )
      .orderBy(grantOf.userId)
      .limit(params.limit);
    return rows.map((row) => row.userId);
  }

  async lockEndingNotices(
    params: FindPremiumGrantEndingNoticesParams,
  ): Promise<PremiumGrantEndingNotice[]> {
    const rows = await this.db
      .select({ grantId: grantOf.id, userId: grantOf.userId, endsAt: grantOf.endsAt })
      .from(grantOf)
      .where(
        and(
          eq(grantOf.status, "ACTIVE"),
          isNull(grantOf.endingNotifiedAt),
          gt(grantOf.endsAt, params.now),
          lte(grantOf.endsAt, params.endsBefore),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(nextOf)
              .where(
                and(
                  eq(nextOf.userId, grantOf.userId),
                  ne(nextOf.id, grantOf.id),
                  or(
                    eq(nextOf.status, "BANKED"),
                    and(eq(nextOf.status, "ACTIVE"), gt(nextOf.endsAt, grantOf.endsAt)),
                  ),
                ),
              ),
          ),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(storeOf)
              .where(
                and(
                  this.storeOfGrantUser(),
                  inArray(storeOf.status, ["ACTIVE", "CANCELLED"]),
                  gte(storeOf.expiresAt, grantOf.endsAt),
                ),
              ),
          ),
          params.after == null
            ? undefined
            : sql`(${grantOf.endsAt}, ${grantOf.id}) > (${timestampText(params.after.endsAt)}::timestamp(3), ${params.after.grantId})`,
        ),
      )
      .orderBy(grantOf.endsAt, grantOf.id)
      .limit(params.limit)
      .for("update", { of: grantOf, skipLocked: true });
    return rows.flatMap((row) =>
      row.endsAt == null ? [] : [{ grantId: row.grantId, userId: row.userId, endsAt: row.endsAt }],
    );
  }

  async markEndingNotified(grantIds: readonly string[], notifiedAt: Date): Promise<void> {
    if (grantIds.length === 0) {
      return;
    }
    await this.db
      .update(premiumGrant)
      .set({ endingNotifiedAt: notifiedAt })
      .where(and(inArray(premiumGrant.id, [...grantIds]), isNull(premiumGrant.endingNotifiedAt)));
  }
}
