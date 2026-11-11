import { REWARD_TYPE } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, lt, lte, ne, or, sql, sum } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { rewardGrant } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type RewardGrantFailure,
  RewardGrantRepositoryPort,
} from "../../application/ports/reward-grant.repository.port.js";
import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { InviterRewardTotal } from "../../domain/invite-reward.domain-service.js";
import { INVITE_REWARD_MAX_ATTEMPTS } from "../../domain/invites.constants.js";
import { RewardGrantId } from "../../domain/reward-grant-id.vo.js";
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

  async nextId(): Promise<RewardGrantId> {
    return RewardGrantId.reconstitute(createEntityId());
  }

  async addAll(grants: readonly RewardGrant[]): Promise<number> {
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

  async summarizeInviterRewards(
    inviterId: UserId,
    windowStart: Temporal.Instant,
  ): Promise<InviterRewardTotal[]> {
    const ownRedemptionId = await this.#findOwnRedemptionId(inviterId);
    const inviterGrants = this.#inviterGrants(inviterId, ownRedemptionId);
    // 전체·적용 합계는 (종류, 상태)로, 상한 기간 합계는 기간 조건을 건 종류별로 한 번씩 묶는다
    const [byStatus, inWindow] = await Promise.all([
      this.#db
        .select({
          rewardType: rewardGrant.rewardType,
          status: rewardGrant.status,
          quantity: sum(rewardGrant.quantity).mapWith(Number),
        })
        .from(rewardGrant)
        .where(inviterGrants)
        .groupBy(rewardGrant.rewardType, rewardGrant.status),
      this.#db
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

  // 초대받은 사람으로 받은 자기 보상은 같은 사람의 초대한 사람 보상에서 뺀다
  async #findOwnRedemptionId(userId: UserId): Promise<string | null> {
    const own = await this.#db.query.inviteRedemption.findFirst({
      columns: { id: true },
      where: { inviteeId: userId.value },
    });
    return own?.id ?? null;
  }

  #inviterGrants(inviterId: UserId, ownRedemptionId: string | null) {
    return and(
      eq(rewardGrant.recipientId, inviterId.value),
      eq(rewardGrant.sourceType, "INVITE_REDEMPTION"),
      ownRedemptionId == null ? undefined : ne(rewardGrant.sourceId, ownRedemptionId),
      // 자동 재시도를 다 쓴 FAILED는 받지 못한 보상이라 상한을 차지하지 않는다
      or(ne(rewardGrant.status, "FAILED"), lt(rewardGrant.attempts, INVITE_REWARD_MAX_ATTEMPTS)),
    );
  }
}
