import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";
import sql from "sql-template-tag";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  FindRetryableRewardSourcesParams,
  InviterRewardLedgerEntry,
  RewardGrantRecord,
  RewardGrantRepositoryPort,
} from "../../../application/ports/invites/reward-grant.repository.port.js";
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

  async findInviterLedger(inviterId: string): Promise<InviterRewardLedgerEntry[]> {
    const ownRedemptionId = await this.#findOwnRedemptionId(inviterId);
    const rows = decodeRecord(
      "RewardGrant",
      await this.#inviterGrants(inviterId, ownRedemptionId)
        .select("rewardType", "quantity", "status", "createdAt")
        .orderBy((grant) => grant.createdAt.asc())
        .all(),
    );
    return rows.map((row) => ({
      rewardType: row.rewardType,
      quantity: row.quantity,
      status: row.status,
      grantedAt: row.createdAt,
    }));
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
