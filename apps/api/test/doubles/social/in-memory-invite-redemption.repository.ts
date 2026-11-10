import type { RedemptionStatus } from "@aido/api/vocabulary";

import { InviteRedemptionRepositoryPort } from "#api/modules/social/invites/application/ports/invite-redemption.repository.port";
import type { InviteRedemptionSummary } from "#api/modules/social/invites/application/read-models/invite-redemption-summary.read-model";
import type { InvitedFriend } from "#api/modules/social/invites/application/read-models/invited-friend.read-model";
import type { QualifyReminderCandidate } from "#api/modules/social/invites/application/read-models/qualify-reminder-candidate.read-model";
import { InviteRedemptionId } from "#api/modules/social/invites/domain/invite-redemption-id.vo";
import { InviteRedemption } from "#api/modules/social/invites/domain/invite-redemption.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { type InviteFixtureUser, INVITE_FIXTURE_USERS } from "#test/fixtures/social/invite.fixture";

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function copyOf(redemption: InviteRedemption): InviteRedemption {
  return InviteRedemption.reconstitute(redemption.toPrimitives());
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

export class InMemoryInviteRedemptionRepository extends InviteRedemptionRepositoryPort {
  readonly #redemptions = new Map<string, InviteRedemption>();
  readonly #users = new Map<string, InviteFixtureUser>();
  #sequence = 0;

  constructor(
    redemptions: readonly InviteRedemption[] = [],
    users: readonly InviteFixtureUser[] = INVITE_FIXTURE_USERS,
  ) {
    super();
    for (const user of users) {
      this.#users.set(user.id, user);
    }
    for (const redemption of redemptions) {
      this.#redemptions.set(redemption.id.value, copyOf(redemption));
    }
  }

  get size(): number {
    return this.#redemptions.size;
  }

  async nextId(): Promise<InviteRedemptionId> {
    this.#sequence += 1;
    return InviteRedemptionId.reconstitute(`c${String(this.#sequence).padStart(24, "0")}`);
  }

  async add(redemption: InviteRedemption): Promise<boolean> {
    if (this.#all().some((existing) => existing.inviteeId.equals(redemption.inviteeId))) {
      return false;
    }
    this.#redemptions.set(redemption.id.value, copyOf(redemption));
    return true;
  }

  async save(redemption: InviteRedemption): Promise<void> {
    if (this.#redemptions.has(redemption.id.value)) {
      this.#redemptions.set(redemption.id.value, copyOf(redemption));
    }
  }

  async existsJoinedByInviteeId(inviteeId: UserId): Promise<boolean> {
    return this.#all().some(
      (redemption) => redemption.inviteeId.equals(inviteeId) && redemption.status === "JOINED",
    );
  }

  async findByInviteeIdForUpdate(inviteeId: UserId): Promise<InviteRedemption | null> {
    const found = this.#all().find((redemption) => redemption.inviteeId.equals(inviteeId));
    return found == null ? null : copyOf(found);
  }

  async findByIdForUpdate(redemptionId: InviteRedemptionId): Promise<InviteRedemption | null> {
    const found = this.#redemptions.get(redemptionId.value);
    return found == null ? null : copyOf(found);
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

  async expireJoinedBefore(at: Temporal.Instant, limit: number): Promise<number> {
    const expiring = this.#all()
      .filter(
        (redemption) =>
          redemption.status === "JOINED" && Temporal.Instant.compare(redemption.expiresAt, at) <= 0,
      )
      .map((redemption) => ({
        redemption,
        expiresAt: redemption.expiresAt,
        idValue: redemption.id.value,
      }))
      .toSorted(compareExpiringFirst)
      .slice(0, limit);
    for (const { redemption } of expiring) {
      redemption.expire(at);
      this.#redemptions.set(redemption.id.value, copyOf(redemption));
    }
    return expiring.length;
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
    return this.#all()
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

  #all(): InviteRedemption[] {
    return [...this.#redemptions.values()];
  }

  #ownedBy(inviterId: UserId): InviteRedemption[] {
    return this.#all().filter((redemption) => redemption.inviterId?.equals(inviterId) === true);
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
