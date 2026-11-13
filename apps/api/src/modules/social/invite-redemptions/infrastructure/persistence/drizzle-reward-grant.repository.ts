import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, lt, lte, ne, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { rewardGrant } from "#api/platform/database/schema/index";

import {
  type RewardGrantFailure,
  RewardGrantRepositoryPort,
} from "../../application/ports/reward-grant.repository.port.js";
import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { RewardGrantId } from "../../domain/reward-grant-id.vo.js";
import type { RewardGrant } from "../../domain/reward-grant.entity.js";
import {
  REWARD_GRANT_COLUMNS,
  toRewardGrant,
  toRewardGrantRow,
} from "./reward-grant-row.mapper.js";

// lastErrorCode 칸 길이
const ERROR_CODE_MAX_LENGTH = 100;

@Injectable()
export class DrizzleRewardGrantRepository implements RewardGrantRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async addPending(grants: readonly RewardGrant[]): Promise<number> {
    if (grants.length === 0) {
      return 0;
    }
    const inserted = await this.#db
      .insert(rewardGrant)
      .values(
        grants.map((grant) => {
          const row = toRewardGrantRow(grant);
          return { ...row, updatedAt: row.createdAt };
        }),
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

  async listByRedemptionId(redemptionId: InviteRedemptionId): Promise<RewardGrant[]> {
    const rows = await this.#db.query.rewardGrant.findMany({
      columns: REWARD_GRANT_COLUMNS,
      where: { sourceType: "INVITE_REDEMPTION", sourceId: redemptionId.value },
      orderBy: { id: "asc" },
    });
    return rows.map(toRewardGrant);
  }

  async markApplied(grantId: RewardGrantId, appliedAt: Temporal.Instant): Promise<boolean> {
    const updated = await this.#db
      .update(rewardGrant)
      .set({ status: "APPLIED", appliedAt, updatedAt: appliedAt })
      .where(
        and(eq(rewardGrant.id, grantId.value), inArray(rewardGrant.status, ["PENDING", "FAILED"])),
      )
      .returning({ id: rewardGrant.id });
    return updated.length === 1;
  }

  async markFailed(grantId: RewardGrantId, failure: RewardGrantFailure): Promise<number | null> {
    const [row] = await this.#db
      .update(rewardGrant)
      .set({
        status: "FAILED",
        attempts: sql`${rewardGrant.attempts} + ${failure.countsAttempt ? 1 : 0}`,
        lastErrorCode: failure.errorCode.slice(0, ERROR_CODE_MAX_LENGTH),
        updatedAt: failure.failedAt,
      })
      .where(and(eq(rewardGrant.id, grantId.value), ne(rewardGrant.status, "APPLIED")))
      .returning({ attempts: rewardGrant.attempts });
    return row?.attempts ?? null;
  }

  async listRetryableRedemptionIds(params: {
    readonly maxAttempts: number;
    readonly createdBefore: Temporal.Instant;
    readonly afterRedemptionId: InviteRedemptionId | null;
    readonly limit: number;
  }): Promise<InviteRedemptionId[]> {
    // 수락 한 건의 지급 여러 개를 sourceId로 묶어 keyset으로 넘긴다
    const groups = await this.#db
      .select({ sourceId: rewardGrant.sourceId })
      .from(rewardGrant)
      .where(
        and(
          eq(rewardGrant.sourceType, "INVITE_REDEMPTION"),
          inArray(rewardGrant.status, ["PENDING", "FAILED"]),
          lt(rewardGrant.attempts, params.maxAttempts),
          lte(rewardGrant.createdAt, params.createdBefore),
          params.afterRedemptionId == null
            ? undefined
            : gt(rewardGrant.sourceId, params.afterRedemptionId.value),
        ),
      )
      .groupBy(rewardGrant.sourceId)
      .orderBy(asc(rewardGrant.sourceId))
      .limit(params.limit);
    return groups.map((group) => InviteRedemptionId.reconstitute(group.sourceId));
  }
}
