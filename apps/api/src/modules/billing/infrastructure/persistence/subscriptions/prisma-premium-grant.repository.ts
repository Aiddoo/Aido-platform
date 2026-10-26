import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import sql, { empty, join } from "sql-template-tag";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
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

const USER_ROW = sqlRowSpec({ userId: "pg/text@1" });
const NOTICE_ROW = sqlRowSpec({
  grantId: "pg/text@1",
  userId: "pg/text@1",
  endsAt: "pg/timestamp-string@1",
});

// 보상 기간 사용자가 소유한 스토어 행이다. 최종 판단은 PremiumAccessPolicy가 같은 규칙으로 다시 한다
const STORE_OF_GRANT_USER = sql`
  SELECT 1 FROM "Subscription" AS "store"
  WHERE "store"."userId" = "grant"."userId"
    AND "store"."deletedAt" IS NULL`;

// isStoreEntitlementValid와 같은 조건: 자동 갱신 중이면 만료 뒤 유예 시간까지, 취소했으면 만료 전까지 유효하다
function validStoreOfGrantUser(now: Date) {
  return sql`${STORE_OF_GRANT_USER}
    AND (
      ("store"."status" = 'ACTIVE' AND "store"."expiresAt" > ${storeRenewalCutoff(now)})
      OR ("store"."status" = 'CANCELLED' AND "store"."expiresAt" > ${now})
    )`;
}

@Injectable()
export class PrismaPremiumGrantRepository implements PremiumGrantRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findOpenByUserId(userId: string): Promise<PremiumGrant[]> {
    const rows = decodeRecord(
      "PremiumGrant",
      await this.client.orm.public.PremiumGrant.where((grant) =>
        and(grant.userId.eq(userId), grant.status.in(["BANKED", "ACTIVE"])),
      )
        .select(
          "id",
          "userId",
          "source",
          "sourceKey",
          "durationDays",
          "status",
          "startsAt",
          "endsAt",
          "endingNotifiedAt",
          "createdAt",
        )
        .orderBy((grant) => grant.createdAt.asc())
        .all(),
    );
    return rows.map((row) => PremiumGrant.reconstitute(row));
  }

  async findLastEndedAt(userId: string): Promise<Date | null> {
    const row = decodeRecord(
      "PremiumGrant",
      await this.client.orm.public.PremiumGrant.where((grant) =>
        and(grant.userId.eq(userId), grant.status.eq("ENDED"), grant.endsAt.isNotNull()),
      )
        .select("endsAt")
        .orderBy((grant) => grant.endsAt.desc())
        .first(),
    );
    return row?.endsAt ?? null;
  }

  async create(plan: PremiumGrantCreationPlan): Promise<boolean> {
    const inserted = await this.client.orm.public.PremiumGrant.createAndCount(
      [encodeCreate("PremiumGrant", plan)],
      { onConflict: "skip", conflictOn: ["sourceKey"] },
    );
    return inserted === 1;
  }

  async saveAll(grants: readonly PremiumGrant[]): Promise<void> {
    if (grants.length === 0) return;
    const updatedAt = now();
    // updateAll은 모든 행에 같은 값을 쓰므로 행마다 다른 기간은 UPDATE … FROM (VALUES …) 한 문장으로 바꾼다
    const values = grants.map((grant) => {
      const state = grant.toPersistence();
      return sql`(${grant.id}, ${state.status}, ${state.startsAt}::timestamp(3), ${state.endsAt}::timestamp(3))`;
    });
    await this.client.execute(
      sqlStatement(
        this.client,
        sql`
          UPDATE "PremiumGrant" AS "grant"
          SET "status" = changed."status"::"PremiumGrantStatus",
              "startsAt" = changed."startsAt",
              "endsAt" = changed."endsAt",
              "updatedAt" = ${updatedAt}
          FROM (VALUES ${join(values)}) AS changed("id", "status", "startsAt", "endsAt")
          WHERE "grant"."id" = changed."id"
        `,
      )
        .affectedCount()
        .build(),
    );
  }

  async findUserIdsToReconcile(params: FindPremiumGrantUsersToReconcileParams): Promise<string[]> {
    // PremiumAccessPolicy.planReconciliation이 바꿀 것이 있는 사용자만 고른다(끝낼 기간, 시작할 기간,
    // 스토어가 유효해 다시 쌓거나 끊을 기간). 정책보다 넓게 고르면 같은 사용자를 실행마다 헛되이 다시 잠근다.
    // PremiumGrant와 Subscription은 contract 관계가 아니라 ORM으로는 User를 거친 relation filter가 되고,
    // 그 계획이 전체 User·Subscription을 훑는 hashed subplan이 되어 userId 상관 NOT EXISTS를 raw SQL로 둔다
    const after =
      params.afterUserId == null ? empty : sql`AND "grant"."userId" > ${params.afterUserId}`;
    const rows = decodeSqlRows(
      USER_ROW,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
            SELECT DISTINCT "grant"."userId" AS "userId"
            FROM "PremiumGrant" AS "grant"
            WHERE (
              ("grant"."status" = 'ACTIVE' AND "grant"."endsAt" <= ${params.now})
              OR (
                "grant"."status" = 'BANKED'
                AND NOT EXISTS (${validStoreOfGrantUser(params.now)})
                AND NOT EXISTS (
                  SELECT 1 FROM "PremiumGrant" AS "current"
                  WHERE "current"."userId" = "grant"."userId"
                    AND "current"."status" = 'ACTIVE'
                    AND "current"."endsAt" > ${params.now}
                )
              )
              OR (
                "grant"."status" = 'ACTIVE'
                AND "grant"."endsAt" > ${params.now}
                AND EXISTS (${validStoreOfGrantUser(params.now)})
              )
            )
            ${after}
            ORDER BY "grant"."userId"
            LIMIT ${params.limit}
          `,
        )
          .returnsRow(USER_ROW)
          .build(),
      ),
    );
    return rows.map((row) => row.userId);
  }

  async lockEndingNotices(
    params: FindPremiumGrantEndingNoticesParams,
  ): Promise<PremiumGrantEndingNotice[]> {
    // ORM 비교 연산(gt·gte)은 값만 받아 바깥 기간의 endsAt과 견주는 상관 NOT EXISTS를 raw SQL로 둔다
    const after =
      params.after == null
        ? empty
        : sql`AND ("grant"."endsAt", "grant"."id") > (${params.after.endsAt}::timestamp(3), ${params.after.grantId})`;
    return decodeSqlRows(
      NOTICE_ROW,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
            SELECT "grant"."id" AS "grantId", "grant"."userId" AS "userId", "grant"."endsAt" AS "endsAt"
            FROM "PremiumGrant" AS "grant"
            WHERE "grant"."status" = 'ACTIVE'
              AND "grant"."endingNotifiedAt" IS NULL
              AND "grant"."endsAt" > ${params.now}
              AND "grant"."endsAt" <= ${params.endsBefore}
              AND NOT EXISTS (
                SELECT 1 FROM "PremiumGrant" AS "next"
                WHERE "next"."userId" = "grant"."userId"
                  AND "next"."id" <> "grant"."id"
                  AND ("next"."status" = 'BANKED'
                    OR ("next"."status" = 'ACTIVE' AND "next"."endsAt" > "grant"."endsAt"))
              )
              AND NOT EXISTS (
                ${STORE_OF_GRANT_USER}
                  AND "store"."status" IN ('ACTIVE', 'CANCELLED')
                  AND "store"."expiresAt" >= "grant"."endsAt"
              )
              ${after}
            ORDER BY "grant"."endsAt", "grant"."id"
            LIMIT ${params.limit}
            FOR UPDATE OF "grant" SKIP LOCKED
          `,
        )
          .returnsRow(NOTICE_ROW)
          .build(),
      ),
    );
  }

  async markEndingNotified(grantIds: readonly string[], notifiedAt: Date): Promise<void> {
    if (grantIds.length === 0) return;
    await this.client.orm.public.PremiumGrant.where((grant) =>
      and(grant.id.in([...grantIds]), grant.endingNotifiedAt.isNull()),
    ).updateAndCount(encodePatch("PremiumGrant", { endingNotifiedAt: notifiedAt }));
  }
}
