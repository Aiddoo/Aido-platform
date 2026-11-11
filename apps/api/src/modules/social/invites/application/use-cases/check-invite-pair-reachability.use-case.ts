import type { UserBlockReaderPort } from "#api/modules/social/blocks/social-blocks.public";
import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface CheckInvitePairReachabilityQuery {
  readonly inviteeId: UserId;
  readonly inviterId: UserId;
}

export interface CheckInvitePairReachabilityDependencies {
  readonly followReader: Pick<FollowReaderPort, "isCurrentMutualFriend">;
  readonly blockReader: Pick<UserBlockReaderPort, "findRelation">;
}

/**
 * 초대 진행 알림은 두 사람이 지금도 친구이고 어느 쪽도 차단하지 않았을 때만 보낸다.
 * 친구를 끊었거나 차단한 상대의 소식·이름을 알림으로 다시 꺼내지 않는다.
 */
export class CheckInvitePairReachabilityUseCase {
  readonly #dependencies: CheckInvitePairReachabilityDependencies;

  constructor(dependencies: CheckInvitePairReachabilityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: CheckInvitePairReachabilityQuery): Promise<boolean> {
    const { inviteeId, inviterId } = query;
    const [areFriends, relation] = await Promise.all([
      this.#dependencies.followReader.isCurrentMutualFriend(inviteeId, inviterId),
      this.#dependencies.blockReader.findRelation(inviteeId, inviterId),
    ]);
    return areFriends && !relation.isBlocking && !relation.isBlockedBy;
  }
}
