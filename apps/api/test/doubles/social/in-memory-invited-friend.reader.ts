import type { RedemptionStatus } from "@aido/api/vocabulary";

import { InvitedFriendReaderPort } from "#api/modules/social/invite-redemptions/application/ports/invited-friend.reader.port";
import type { InvitedFriendReadModel } from "#api/modules/social/invite-redemptions/application/read-models/invited-friend.read-model";
import type { InviteRedemption } from "#api/modules/social/invite-redemptions/domain/invite-redemption.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { type InviteFixtureUser, INVITE_FIXTURE_USERS } from "#test/fixtures/social/invite.fixture";

import type { InMemoryInviteRedemptionRepository } from "./in-memory-invite-redemption.repository.js";

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

// Drizzle 조회와 같은 순서: 수락 시각·id 내림차순
function compareNewestFirst(left: InviteRedemption, right: InviteRedemption): number {
  return (
    Temporal.Instant.compare(right.joinedAt, left.joinedAt) ||
    compareText(right.id.value, left.id.value)
  );
}

// 수락 저장소 대역의 상태를 읽고 초대받은 사람 프로필은 fixture 사용자에서 읽는다
export class InMemoryInvitedFriendReader extends InvitedFriendReaderPort {
  readonly #redemptions: InMemoryInviteRedemptionRepository;
  readonly #users = new Map<string, InviteFixtureUser>();

  constructor(
    redemptions: InMemoryInviteRedemptionRepository,
    users: readonly InviteFixtureUser[] = INVITE_FIXTURE_USERS,
  ) {
    super();
    this.#redemptions = redemptions;
    for (const user of users) {
      this.#users.set(user.id, user);
    }
  }

  async listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly limit: number;
  }): Promise<InvitedFriendReadModel[]> {
    const { inviterId, afterInviteeId, status, limit } = params;
    const owned = this.#redemptions
      .listAll()
      .filter((redemption) => redemption.inviterId?.equals(inviterId) === true)
      .toSorted(compareNewestFirst);
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

  #toInvitedFriend(redemption: InviteRedemption): InvitedFriendReadModel {
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
