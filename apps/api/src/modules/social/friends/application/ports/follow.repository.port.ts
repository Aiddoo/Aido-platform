import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SortOrderShift } from "../../domain/friend-ordering.domain-service.js";
import type { FriendshipId } from "../../domain/friendship-id.vo.js";
import type { Friendship } from "../../domain/friendship.aggregate.js";

// 맞팔(mutual)은 두 방향 관계가 모두 ACCEPTED인 상대다. 친구 수·친구 판정은 모두 이 기준이다
export abstract class FollowRepositoryPort {
  abstract nextId(): Promise<FriendshipId>;
  abstract findByFollowerAndFollowing(
    followerId: UserId,
    followingId: UserId,
  ): Promise<Friendship | null>;
  abstract findAcceptedByIdAndFollowerId(
    friendshipId: FriendshipId,
    followerId: UserId,
  ): Promise<Friendship | null>;
  // follower 친구 목록(ACCEPTED)의 가장 큰 순서다
  abstract findMaxFriendSortOrder(followerId: UserId): Promise<number | null>;
  abstract countMutualFriends(userId: UserId): Promise<number>;
  abstract existsMutualFriendship(userId: UserId, targetUserId: UserId): Promise<boolean>;
  abstract listMutualFriendIds(userId: UserId): Promise<UserId[]>;
  // 밀린 친구도 수정 시각(friendsSince)이 바뀐다(옮기기 전 $onUpdate 동작)
  abstract shiftFriendSortOrders(
    followerId: UserId,
    shift: SortOrderShift,
    now: Temporal.Instant,
  ): Promise<void>;
  // 같은 두 사람·방향의 다른 관계가 이미 있으면 FOLLOW_0901로 거절한다
  abstract save(friendship: Friendship): Promise<void>;
  abstract delete(friendship: Friendship): Promise<void>;
}
