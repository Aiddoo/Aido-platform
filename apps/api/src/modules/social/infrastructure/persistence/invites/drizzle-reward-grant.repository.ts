import { REWARD_TYPE } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, lt, lte, ne, or, sql, sum } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { rewardGrant } from "#api/platform/database/schema/index";

import type {
  FindRetryableRewardSourcesParams,
  RewardGrantRecord,
  RewardGrantRepositoryPort,
} from "../../../application/ports/invites/reward-grant.repository.port.js";
import type { InviterRewardTotal } from "../../../domain/policies/invites/invite-reward.policy.js";
import {
  INVITE_REWARD_MAX_ATTEMPTS,
  type RewardGrantPlan,
  type RewardSourceType,
} from "../../../domain/types/invites/reward-grant.types.js";

@Injectable()
export class DrizzleRewardGrantRepository implements RewardGrantRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async createPending(plans: readonly RewardGrantPlan[]): Promise<number> {
    if (plans.length === 0) {
      return 0;
    }
    const inserted = await this.db
      .insert(rewardGrant)
      .values(
        plans.map((plan) => ({
          recipientId: plan.recipientId,
          sourceType: plan.sourceType,
          sourceId: plan.sourceId,
          rewardType: plan.rewardType,
          quantity: plan.quantity,
          status: "PENDING" as const,
        })),
      )
      .onConflictDoNothing({
        target: [
          rewardGrant.sourceType,
          rewardGrant.sourceId,
          rewardGrant.recipientId,
          rewardGrant.rewardType,
        ],
      })
      .returning({ id: rewardGrant.id });
    return inserted.length;
  }

  async summarizeInviterRewards(
    inviterId: string,
    windowStart: Date,
  ): Promise<InviterRewardTotal[]> {
    const ownRedemptionId = await this.#findOwnRedemptionId(inviterId);
    const inviterGrants = this.#inviterGrants(inviterId, ownRedemptionId);
    // 전체·적용 합계는 (종류, 상태)로, 상한 기간 합계는 기간 조건을 건 종류별로 한 번씩 묶는다
    const [byStatus, inWindow] = await Promise.all([
      this.db
        .select({
          rewardType: rewardGrant.rewardType,
          status: rewardGrant.status,
          quantity: sum(rewardGrant.quantity).mapWith(Number),
        })
        .from(rewardGrant)
        .where(inviterGrants)
        .groupBy(rewardGrant.rewardType, rewardGrant.status),
      this.db
        .select({
          rewardType: rewardGrant.rewardType,
          quantity: sum(rewardGrant.quantity).mapWith(Number),
        })
        .from(rewardGrant)
        .where(and(inviterGrants, gt(rewardGrant.createdAt, windowStart)))
        .groupBy(rewardGrant.rewardType),
    ]);

    return Object.values(REWARD_TYPE).flatMap((rewardType) => {
      const rows = byStatus.filter((row) => row.rewardType === rewardType);
      if (rows.length === 0) {
        return [];
      }
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

  findBySource(sourceType: RewardSourceType, sourceId: string): Promise<RewardGrantRecord[]> {
    return this.db.query.rewardGrant.findMany({
      columns: {
        id: true,
        recipientId: true,
        sourceType: true,
        sourceId: true,
        rewardType: true,
        quantity: true,
        status: true,
        attempts: true,
        createdAt: true,
      },
      where: { sourceType, sourceId },
      orderBy: { id: "asc" },
    });
  }

  async markApplied(grantId: string, appliedAt: Date): Promise<boolean> {
    const updated = await this.db
      .update(rewardGrant)
      .set({ status: "APPLIED", appliedAt })
      .where(and(eq(rewardGrant.id, grantId), inArray(rewardGrant.status, ["PENDING", "FAILED"])))
      .returning({ id: rewardGrant.id });
    return updated.length === 1;
  }

  async markFailed(
    grantId: string,
    failure: {
      readonly errorCode: string;
      readonly failedAt: Date;
      readonly countsAttempt: boolean;
    },
  ): Promise<number | null> {
    const [row] = await this.db
      .update(rewardGrant)
      .set({
        status: "FAILED",
        attempts: sql`${rewardGrant.attempts} + ${failure.countsAttempt ? 1 : 0}`,
        lastErrorCode: failure.errorCode.slice(0, 100),
        updatedAt: failure.failedAt,
      })
      .where(and(eq(rewardGrant.id, grantId), ne(rewardGrant.status, "APPLIED")))
      .returning({ attempts: rewardGrant.attempts });
    return row?.attempts ?? null;
  }

  async findRetryableSourceIds(params: FindRetryableRewardSourcesParams): Promise<string[]> {
    // 수락 한 건의 지급 여러 개를 sourceId로 묶어 keyset으로 넘긴다
    const groups = await this.db
      .select({ sourceId: rewardGrant.sourceId })
      .from(rewardGrant)
      .where(
        and(
          eq(rewardGrant.sourceType, "INVITE_REDEMPTION"),
          inArray(rewardGrant.status, ["PENDING", "FAILED"]),
          lt(rewardGrant.attempts, params.maxAttempts),
          lte(rewardGrant.createdAt, params.createdBefore),
          params.afterSourceId == null ? undefined : gt(rewardGrant.sourceId, params.afterSourceId),
        ),
      )
      .groupBy(rewardGrant.sourceId)
      .orderBy(asc(rewardGrant.sourceId))
      .limit(params.limit);
    return groups.map((group) => group.sourceId);
  }

  // 초대받은 사람으로 받은 자기 보상은 같은 사람의 초대한 사람 보상에서 뺀다
  async #findOwnRedemptionId(userId: string): Promise<string | null> {
    const own = await this.db.query.inviteRedemption.findFirst({
      columns: { id: true },
      where: { inviteeId: userId },
    });
    return own?.id ?? null;
  }

  #inviterGrants(inviterId: string, ownRedemptionId: string | null) {
    return and(
      eq(rewardGrant.recipientId, inviterId),
      eq(rewardGrant.sourceType, "INVITE_REDEMPTION"),
      ownRedemptionId == null ? undefined : ne(rewardGrant.sourceId, ownRedemptionId),
      // 자동 재시도를 다 쓴 FAILED는 받지 못한 보상이라 상한을 차지하지 않는다
      or(ne(rewardGrant.status, "FAILED"), lt(rewardGrant.attempts, INVITE_REWARD_MAX_ATTEMPTS)),
    );
  }
}
