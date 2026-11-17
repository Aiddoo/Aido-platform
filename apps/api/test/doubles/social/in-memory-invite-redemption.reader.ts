import { REWARD_TYPE, type RedemptionStatus } from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import { InviteRedemptionReaderPort } from "#api/modules/social/invite-redemptions/application/ports/invite-redemption.reader.port";
import type { InviteRedemptionSummaryReadModel } from "#api/modules/social/invite-redemptions/application/read-models/invite-redemption-summary.read-model";
import type { QualifyReminderCandidateReadModel } from "#api/modules/social/invite-redemptions/application/read-models/qualify-reminder-candidate.read-model";
import type { InviteRedemption } from "#api/modules/social/invite-redemptions/domain/invite-redemption.aggregate";
import { INVITE_REWARD_MAX_ATTEMPTS } from "#api/modules/social/invite-redemptions/domain/invite-redemptions.constants";
import type { InviterRewardTotal } from "#api/modules/social/invite-redemptions/domain/invite-reward.domain-service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryInviteRedemptionRepository } from "./in-memory-invite-redemption.repository.js";
import type { InMemoryRewardGrantRepository } from "./in-memory-reward-grant.repository.js";

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

// Drizzle 저장소와 같은 순서: 마감·id 오름차순
function compareExpiringFirst(
  left: Pick<InviteRedemption, "expiresAt"> & { readonly idValue: string },
  right: Pick<InviteRedemption, "expiresAt"> & { readonly idValue: string },
): number {
  return (
    Temporal.Instant.compare(left.expiresAt, right.expiresAt) ||
    compareText(left.idValue, right.idValue)
  );
}

// 수락 저장소·보상 원장 대역의 상태를 읽는다
export class InMemoryInviteRedemptionReader extends InviteRedemptionReaderPort {
  readonly #redemptions: InMemoryInviteRedemptionRepository;
  readonly #grants: InMemoryRewardGrantRepository;

  constructor(
    redemptions: InMemoryInviteRedemptionRepository,
    grants: InMemoryRewardGrantRepository,
  ) {
    super();
    this.#redemptions = redemptions;
    this.#grants = grants;
  }

  async summarizeByInviterId(inviterId: UserId): Promise<InviteRedemptionSummaryReadModel> {
    const owned = this.#ownedBy(inviterId);
    const countOf = (status: RedemptionStatus) =>
      owned.filter((redemption) => redemption.status === status).length;
    return {
      joinedCount: countOf("JOINED"),
      qualifiedCount: countOf("QUALIFIED"),
      rewardedCount: countOf("REWARDED"),
      rejectedCount: countOf("REJECTED"),
    };
  }

  async summarizeInviterRewards(
    inviterId: UserId,
    windowStart: Temporal.Instant,
  ): Promise<InviterRewardTotal[]> {
    const ownRedemptionId = this.#redemptions
      .listAll()
      .find((redemption) => redemption.inviteeId.equals(inviterId))?.id.value;
    const inviterGrants = this.#grants
      .listAll()
      .filter(
        (grant) =>
          grant.recipientId === inviterId.value &&
          grant.sourceType === "INVITE_REDEMPTION" &&
          grant.sourceId !== ownRedemptionId &&
          (grant.status !== "FAILED" || grant.attempts < INVITE_REWARD_MAX_ATTEMPTS),
      );
    return Object.values(REWARD_TYPE).flatMap((rewardType) => {
      const rows = inviterGrants.filter((grant) => grant.rewardType === rewardType);
      if (rows.length === 0) {
        return [];
      }
      return [
        {
          rewardType,
          quantityInWindow: sumBy(
            rows.filter((grant) => Temporal.Instant.compare(grant.createdAt, windowStart) > 0),
            (grant) => grant.quantity,
          ),
          totalQuantity: sumBy(rows, (grant) => grant.quantity),
          appliedQuantity: sumBy(
            rows.filter((grant) => grant.status === "APPLIED"),
            (grant) => grant.quantity,
          ),
        },
      ];
    });
  }

  async listQualifyReminderCandidates(params: {
    readonly now: Temporal.Instant;
    readonly expiresBefore: Temporal.Instant;
    readonly after: Pick<QualifyReminderCandidateReadModel, "expiresAt" | "redemptionId"> | null;
    readonly limit: number;
  }): Promise<QualifyReminderCandidateReadModel[]> {
    const { now, expiresBefore, after, limit } = params;
    const afterKey =
      after == null ? null : { expiresAt: after.expiresAt, idValue: after.redemptionId };
    return this.#redemptions
      .listAll()
      .filter(
        (redemption) =>
          redemption.status === "JOINED" &&
          redemption.qualifyReminderSentAt == null &&
          redemption.inviterId != null &&
          redemption.inviterRewardEligible &&
          Temporal.Instant.compare(redemption.expiresAt, now) > 0 &&
          Temporal.Instant.compare(redemption.expiresAt, expiresBefore) <= 0,
      )
      .map((redemption) => ({
        redemption,
        expiresAt: redemption.expiresAt,
        idValue: redemption.id.value,
      }))
      .filter((candidate) => afterKey == null || compareExpiringFirst(afterKey, candidate) < 0)
      .toSorted(compareExpiringFirst)
      .slice(0, limit)
      .map(({ redemption }) => ({
        redemptionId: redemption.id.value,
        timezone: redemption.timeZone.value,
        expiresAt: redemption.expiresAt,
        activeDayCount: redemption.activeDays.length,
      }));
  }

  #ownedBy(inviterId: UserId): InviteRedemption[] {
    return this.#redemptions
      .listAll()
      .filter((redemption) => redemption.inviterId?.equals(inviterId) === true);
  }
}
