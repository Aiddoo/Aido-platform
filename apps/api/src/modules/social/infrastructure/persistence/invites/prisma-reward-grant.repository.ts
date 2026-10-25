import { REWARD_TYPE } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";
import { sumBy } from "es-toolkit";
import sql from "sql-template-tag";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  FindRetryableRewardSourcesParams,
  RewardGrantRecord,
  RewardGrantRepositoryPort,
} from "../../../application/ports/invites/reward-grant.repository.port.js";
import type { InviterRewardTotal } from "../../../domain/policies/invites/invite-reward.policy.js";
import type {
  RewardGrantPlan,
  RewardSourceType,
} from "../../../domain/types/invites/reward-grant.types.js";

@Injectable()
export class PrismaRewardGrantRepository implements RewardGrantRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async createPending(plans: readonly RewardGrantPlan[]): Promise<number> {
    if (plans.length === 0) return 0;
    return this.client.orm.public.RewardGrant.createAndCount(
      plans.map((plan) =>
        encodeCreate("RewardGrant", {
          recipientId: plan.recipientId,
          sourceType: plan.sourceType,
          sourceId: plan.sourceId,
          rewardType: plan.rewardType,
          quantity: plan.quantity,
          status: "PENDING",
        }),
      ),
      {
        onConflict: "skip",
        conflictOn: ["sourceType", "sourceId", "recipientId", "rewardType"],
      },
    );
  }

  async summarizeInviterRewards(
    inviterId: string,
    windowStart: Date,
  ): Promise<InviterRewardTotal[]> {
    const ownRedemptionId = await this.#findOwnRedemptionId(inviterId);
    // 전체·적용 합계는 (종류, 상태)로, 상한 기간 합계는 기간 조건을 건 종류별로 한 번씩 묶는다
    const [byStatus, inWindow] = await Promise.all([
      this.#inviterGrants(inviterId, ownRedemptionId)
        .groupBy("rewardType", "status")
        .aggregate((aggregate) => ({ quantity: aggregate.sum("quantity") })),
      this.#inviterGrants(inviterId, ownRedemptionId)
        .where((grant) => grant.createdAt.gt(databaseTimestamp(windowStart)))
        .groupBy("rewardType")
        .aggregate((aggregate) => ({ quantity: aggregate.sum("quantity") })),
    ]);

    return Object.values(REWARD_TYPE).flatMap((rewardType) => {
      const rows = byStatus.filter((row) => row.rewardType === rewardType);
      if (rows.length === 0) return [];
      return [
        {
          rewardType,
          quantityInWindow: inWindow.find((row) => row.rewardType === rewardType)?.quantity ?? 0,
          totalQuantity: sumBy(rows, (row) => row.quantity ?? 0),
          appliedQuantity: sumBy(
            rows.filter((row) => row.status === "APPLIED"),
            (row) => row.quantity ?? 0,
          ),
        },
      ];
    });
  }

  async findBySource(sourceType: RewardSourceType, sourceId: string): Promise<RewardGrantRecord[]> {
    return decodeRecord(
      "RewardGrant",
      await this.client.orm.public.RewardGrant.where((grant) =>
        and(grant.sourceType.eq(sourceType), grant.sourceId.eq(varchar(sourceId, 64))),
      )
        .select(
          "id",
          "recipientId",
          "sourceType",
          "sourceId",
          "rewardType",
          "quantity",
          "status",
          "attempts",
          "createdAt",
        )
        .orderBy((grant) => grant.id.asc())
        .all(),
    );
  }

  async markApplied(grantId: string, appliedAt: Date): Promise<boolean> {
    const updated = await this.client.orm.public.RewardGrant.where((grant) =>
      and(grant.id.eq(grantId), grant.status.in(["PENDING", "FAILED"])),
    ).updateAndCount(encodePatch("RewardGrant", { status: "APPLIED", appliedAt }));
    return updated === 1;
  }

  async markFailed(grantId: string, errorCode: string, failedAt: Date): Promise<void> {
    // ORM update 입력은 리터럴만 받아 attempts + 1 원자 증가를 raw SQL로 둔다
    await this.client.execute(
      sqlStatement(
        this.client,
        sql`
          UPDATE "RewardGrant"
          SET "status" = 'FAILED',
              "attempts" = "attempts" + 1,
              "lastErrorCode" = ${errorCode.slice(0, 100)},
              "updatedAt" = ${failedAt}
          WHERE "id" = ${grantId} AND "status" <> 'APPLIED'
        `,
      )
        .affectedCount()
        .build(),
    );
  }

  async findRetryableSourceIds(params: FindRetryableRewardSourcesParams): Promise<string[]> {
    // 수락 한 건의 지급 여러 개를 sourceId로 묶어 keyset으로 넘긴다
    const groups = await this.client.orm.public.RewardGrant.where((grant) =>
      and(
        grant.sourceType.eq("INVITE_REDEMPTION"),
        grant.status.in(["PENDING", "FAILED"]),
        grant.attempts.lt(params.maxAttempts),
        grant.createdAt.lte(databaseTimestamp(params.createdBefore)),
        params.afterSourceId == null ? all() : grant.sourceId.gt(varchar(params.afterSourceId, 64)),
      ),
    )
      .groupBy("sourceId")
      .orderBy((grant) => grant.sourceId.asc())
      .limit(params.limit)
      .aggregate((aggregate) => ({ count: aggregate.count() }));
    return groups.map((group) => group.sourceId);
  }

  // 초대받은 사람으로 받은 자기 보상은 같은 사람의 초대한 사람 보상에서 뺀다
  async #findOwnRedemptionId(userId: string): Promise<string | null> {
    const own = await this.client.orm.public.InviteRedemption.where({ inviteeId: userId })
      .select("id")
      .first();
    return own?.id ?? null;
  }

  #inviterGrants(inviterId: string, ownRedemptionId: string | null) {
    return this.client.orm.public.RewardGrant.where((grant) =>
      and(
        grant.recipientId.eq(inviterId),
        grant.sourceType.eq("INVITE_REDEMPTION"),
        ownRedemptionId == null ? all() : grant.sourceId.neq(varchar(ownRedemptionId, 64)),
      ),
    );
  }
}
