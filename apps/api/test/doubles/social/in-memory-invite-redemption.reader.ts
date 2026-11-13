import { REWARD_TYPE, type RedemptionStatus } from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import { InviteRedemptionReaderPort } from "#api/modules/social/invite-redemptions/application/ports/invite-redemption.reader.port";
import type { InviteRedemptionSummary } from "#api/modules/social/invite-redemptions/application/read-models/invite-redemption-summary.read-model";
import type { InvitedFriend } from "#api/modules/social/invite-redemptions/application/read-models/invited-friend.read-model";
import type { QualifyReminderCandidate } from "#api/modules/social/invite-redemptions/application/read-models/qualify-reminder-candidate.read-model";
import type { InviteRedemption } from "#api/modules/social/invite-redemptions/domain/invite-redemption.aggregate";
import { INVITE_REWARD_MAX_ATTEMPTS } from "#api/modules/social/invite-redemptions/domain/invite-redemptions.constants";
import type { InviterRewardTotal } from "#api/modules/social/invite-redemptions/domain/invite-reward.domain-service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { type InviteFixtureUser, INVITE_FIXTURE_USERS } from "#test/fixtures/social/invite.fixture";

import type { InMemoryInviteRedemptionRepository } from "./in-memory-invite-redemption.repository.js";
import type { InMemoryRewardGrantRepository } from "./in-memory-reward-grant.repository.js";

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

// Drizzle 저장소와 같은 순서: 수락 시각·id 내림차순
function compareNewestFirst(left: InviteRedemption, right: InviteRedemption): number {
  return (
    Temporal.Instant.compare(right.joinedAt, left.joinedAt) ||
    compareText(right.id.value, left.id.value)
  );
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

// 수락 저장소·보상 원장 대역의 상태를 읽고 초대받은 사람 프로필은 fixture 사용자에서 읽는다
export class InMemoryInviteRedemptionReader extends InviteRedemptionReaderPort {
  readonly #redemptions: InMemoryInviteRedemptionRepository;
  readonly #grants: InMemoryRewardGrantRepository;
  readonly #users = new Map<string, InviteFixtureUser>();

  constructor(
    redemptions: InMemoryInviteRedemptionRepository,
    grants: InMemoryRewardGrantRepository,
    users: readonly InviteFixtureUser[] = INVITE_FIXTURE_USERS,
  ) {
    super();
    this.#redemptions = redemptions;
    this.#grants = grants;
    for (const user of users) {
      this.#users.set(user.id, user);
    }
  }

  async summarizeByInviterId(inviterId: UserId): Promise<InviteRedemptionSummary> {
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

  async listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly limit: number;
  }): Promise<InvitedFriend[]> {
    const { inviterId, afterInviteeId, status, limit } = params;
    const owned = this.#ownedBy(inviterId).toSorted(compareNewestFirst);
    const anchor =
      afterInviteeId == null
        ? null
        : owned.find((redemption) => redemption.inviteeId.equals(afterInviteeId));
    if (afterInviteeId != null && anchor == null) {
      return [];
    }
    return owned
      .filter((redemption) => status == null || redemption.status === status)
      .filter((redemption) => anchor == null || compareNewestFirst(anchor, redemption) < 0)
      .slice(0, limit)
      .map((redemption) => this.#toInvitedFriend(redemption));
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
    readonly after: Pick<QualifyReminderCandidate, "expiresAt" | "redemptionId"> | null;
    readonly limit: number;
  }): Promise<QualifyReminderCandidate[]> {
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

  #toInvitedFriend(redemption: InviteRedemption): InvitedFriend {
    const invitee = this.#users.get(redemption.inviteeId.value);
    if (invitee == null) {
      throw new Error(`초대받은 사람 ${redemption.inviteeId.value}의 프로필이 없습니다`);
    }
    return {
      userId: invitee.id,
      name: invitee.name,
      userTag: invitee.userTag,
      profileImage: invitee.profileImage,
      status: redemption.status,
      activeDayCount: redemption.activeDays.length,
      joinedAt: redemption.joinedAt,
      qualifiedAt: redemption.qualifiedAt,
      rejectionReason: redemption.rejectionReason,
    };
  }
}
