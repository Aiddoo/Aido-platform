import type { FollowReaderPort } from "#api/modules/social/social-friends.public";

import type { UserBlockReaderPort } from "../../ports/blocks/user-block-reader.port.js";

export interface InvitePairReachabilityDependencies {
  readonly followReader: Pick<FollowReaderPort, "isCurrentMutualFriend">;
  readonly blockReader: Pick<UserBlockReaderPort, "findRelation">;
}

/**
 * 초대 진행 알림은 두 사람이 지금도 친구이고 어느 쪽도 차단하지 않았을 때만 보낸다.
 * 친구를 끊었거나 차단한 상대의 소식·이름을 알림으로 다시 꺼내지 않는다.
 */
export async function isInvitePairReachable(
  dependencies: InvitePairReachabilityDependencies,
  inviteeId: string,
  inviterId: string,
): Promise<boolean> {
  const [areFriends, relation] = await Promise.all([
    dependencies.followReader.isCurrentMutualFriend(inviteeId, inviterId),
    dependencies.blockReader.findRelation(inviteeId, inviterId),
  ]);
  return areFriends && !relation.isBlocking && !relation.isBlockedBy;
}
