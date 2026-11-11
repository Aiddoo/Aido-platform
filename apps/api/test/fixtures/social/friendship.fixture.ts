import {
  Friendship,
  type FriendshipPrimitives,
} from "#api/modules/social/friends/domain/friendship.aggregate";

export const FRIENDSHIP_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const FRIENDSHIP_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const FRIENDSHIP_FIXTURE_FRIEND_ID = "clz7x5p8k0002qz0z8z8z8z8z";
export const FRIENDSHIP_FIXTURE_OTHER_USER_ID = "clz7x5p8k0003qz0z8z8z8z8z";

let friendshipSequence = 0;

// id를 주지 않으면 매번 다른 CUID 모양 id를 붙여 한 저장소에 여러 개를 넣을 수 있게 한다
export function createFriendshipFixture(overrides: Partial<FriendshipPrimitives> = {}): Friendship {
  friendshipSequence += 1;
  return Friendship.reconstitute({
    id: `cfriendship${String(friendshipSequence).padStart(14, "0")}`,
    followerId: FRIENDSHIP_FIXTURE_USER_ID,
    followingId: FRIENDSHIP_FIXTURE_FRIEND_ID,
    status: "PENDING",
    sortOrder: 0,
    createdAt: FRIENDSHIP_FIXTURE_NOW,
    updatedAt: FRIENDSHIP_FIXTURE_NOW,
    ...overrides,
  });
}

// 두 방향 모두 ACCEPTED인 친구 쌍이다. sortOrder는 각자 친구 목록의 자리다
export function createMutualFriendshipFixtures(params: {
  readonly userId: string;
  readonly friendId: string;
  readonly userSortOrder?: number;
  readonly friendSortOrder?: number;
}): readonly [Friendship, Friendship] {
  return [
    createFriendshipFixture({
      followerId: params.userId,
      followingId: params.friendId,
      status: "ACCEPTED",
      sortOrder: params.userSortOrder ?? 0,
    }),
    createFriendshipFixture({
      followerId: params.friendId,
      followingId: params.userId,
      status: "ACCEPTED",
      sortOrder: params.friendSortOrder ?? 0,
    }),
  ];
}
