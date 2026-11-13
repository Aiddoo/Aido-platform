import type { RedemptionStatus } from "@aido/api/vocabulary";
import { REWARD_TYPE } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gt, lt, ne, or, sum } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import {
  inviteActiveDay,
  inviteRedemption,
  rewardGrant,
} from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteRedemptionReaderPort } from "../../application/ports/invite-redemption.reader.port.js";
import type { InviteRedemptionSummary } from "../../application/read-models/invite-redemption-summary.read-model.js";
import type { InvitedFriend } from "../../application/read-models/invited-friend.read-model.js";
import type { QualifyReminderCandidate } from "../../application/read-models/qualify-reminder-candidate.read-model.js";
import { INVITE_REWARD_MAX_ATTEMPTS } from "../../domain/invite-redemptions.constants.js";
import type { InviterRewardTotal } from "../../domain/invite-reward.domain-service.js";

@Injectable()
export class DrizzleInviteRedemptionReader implements InviteRedemptionReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  #activeDayCount() {
    return (redemption: typeof inviteRedemption) =>
      this.#db.$count(inviteActiveDay, eq(inviteActiveDay.redemptionId, redemption.id));
  }

  async summarizeByInviterId(inviterId: UserId): Promise<InviteRedemptionSummary> {
    const groups = await this.#db
      .select({ status: inviteRedemption.status, total: count() })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.inviterId, inviterId.value))
      .groupBy(inviteRedemption.status);
    const countOf = (status: RedemptionStatus) =>
      groups.find((group) => group.status === status)?.total ?? 0;
    return {
      joinedCount: countOf("JOINED"),
      qualifiedCount: countOf("QUALIFIED"),
      rewardedCount: countOf("REWARDED"),
      rejectedCount: countOf("REJECTED"),
    };
  }

  async listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly limit: number;
  }): Promise<InvitedFriend[]> {
    const { inviterId, afterInviteeId, status, limit } = params;
    const anchor =
      afterInviteeId == null
        ? null
        : await this.#db.query.inviteRedemption.findFirst({
            columns: { joinedAt: true, id: true },
            where: { inviteeId: afterInviteeId.value, inviterId: inviterId.value },
          });
    if (afterInviteeId != null && anchor == null) {
      return [];
    }

    const rows = await this.#db.query.inviteRedemption.findMany({
      columns: {
        id: true,
        status: true,
        rejectionReason: true,
        joinedAt: true,
        qualifiedAt: true,
      },
      where: {
        inviterId: inviterId.value,
        ...(status != null && { status }),
        ...(anchor != null && {
          RAW: (table) => tupleLessThan([table.joinedAt, table.id], [anchor.joinedAt, anchor.id]),
        }),
      },
      with: {
        invitee: {
          columns: { id: true, userTag: true },
          with: { profile: { columns: { name: true, profileImage: true } } },
        },
      },
      extras: { activeDayCount: this.#activeDayCount() },
      orderBy: { joinedAt: "desc", id: "desc" },
      limit,
    });
    return rows.map((row) => ({
      userId: row.invitee.id,
      name: row.invitee.profile?.name ?? null,
      userTag: row.invitee.userTag,
      profileImage: row.invitee.profile?.profileImage ?? null,
      status: row.status,
      activeDayCount: row.activeDayCount,
      joinedAt: row.joinedAt,
      qualifiedAt: row.qualifiedAt,
      rejectionReason: row.rejectionReason,
    }));
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

  async listQualifyReminderCandidates(params: {
    readonly now: Temporal.Instant;
    readonly expiresBefore: Temporal.Instant;
    readonly after: Pick<QualifyReminderCandidate, "expiresAt" | "redemptionId"> | null;
    readonly limit: number;
  }): Promise<QualifyReminderCandidate[]> {
    const { after } = params;
    const rows = await this.#db.query.inviteRedemption.findMany({
      columns: { id: true, timezone: true, expiresAt: true },
      where: {
        status: "JOINED",
        qualifyReminderSentAt: { isNull: true },
        inviterId: { isNotNull: true },
        inviterRewardEligible: true,
        expiresAt: { gt: params.now, lte: params.expiresBefore },
        ...(after != null && {
          OR: [
            { expiresAt: { gt: after.expiresAt } },
            { expiresAt: { eq: after.expiresAt }, id: { gt: after.redemptionId } },
          ],
        }),
      },
      extras: { activeDayCount: this.#activeDayCount() },
      orderBy: { expiresAt: "asc", id: "asc" },
      limit: params.limit,
    });
    return rows.map((row) => ({
      redemptionId: row.id,
      timezone: row.timezone,
      expiresAt: row.expiresAt,
      activeDayCount: row.activeDayCount,
    }));
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
