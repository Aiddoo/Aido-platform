import { FakeFriendshipCache } from "#test/doubles/social/fake-friendship-cache";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { InMemoryFriendReader } from "#test/doubles/social/in-memory-friend.reader";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import {
  createFriendshipFixture,
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { MutualFriendReaderAdapter } from "../../infrastructure/adapters/mutual-friend-reader.adapter.js";
import { GetFriendsUseCase } from "./get-friends.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const FRIENDS = [
  { id: "cfriend000000000000000001", userTag: "ALPHA001" },
  { id: "cfriend000000000000000002", userTag: "BRAVO002" },
  { id: "cfriend000000000000000003", userTag: "ALPHA003" },
] as const;

function setup() {
  const friendshipRepository = new InMemoryFriendshipRepository([
    ...FRIENDS.flatMap((friend, index) =>
      createMutualFriendshipFixtures({ userId: ME, friendId: friend.id, userSortOrder: index }),
    ),
    // 한쪽만 수락한 관계는 친구가 아니다
    createFriendshipFixture({
      followerId: ME,
      followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
      status: "ACCEPTED",
      sortOrder: 9,
    }),
  ]);
  const profileReader = new InMemoryFriendProfileReader();
  for (const friend of [
    ...FRIENDS,
    { id: FRIENDSHIP_FIXTURE_OTHER_USER_ID, userTag: "OTHR0003" },
  ]) {
    profileReader.addUser(friend);
  }
  const useCase = new GetFriendsUseCase({
    friendReader: new InMemoryFriendReader(friendshipRepository, profileReader),
    mutualFriendReader: new MutualFriendReaderAdapter(
      friendshipRepository,
      profileReader,
      new FakeFriendshipCache(),
    ),
  });
  return { useCase };
}

describe("GetFriendsUseCase — 친구 목록", () => {
  it("맞팔 친구를 순서대로 size만큼 주고 다음 커서와 전체 친구 수를 함께 준다", async () => {
    // Given
    const { useCase } = setup();

    // When
    const first = await useCase.execute({ userId: ME, size: 2 });
    const next = await useCase.execute({
      userId: ME,
      size: 2,
      cursor: first.page.pagination.nextCursor ?? undefined,
    });

    // Then
    expect(first.page.items.map((friend) => friend.user.id)).toEqual([
      FRIENDS[0].id,
      FRIENDS[1].id,
    ]);
    expect(first.page.pagination).toMatchObject({ hasNext: true, size: 2 });
    expect(first.totalCount).toBe(3);
    expect(next.page.items.map((friend) => friend.user.id)).toEqual([FRIENDS[2].id]);
    expect(next.page.pagination).toMatchObject({ hasNext: false, nextCursor: null });
  });

  it("태그 검색은 목록만 거르고 전체 친구 수는 그대로 준다", async () => {
    // Given
    const { useCase } = setup();

    // When
    const result = await useCase.execute({ userId: ME, search: "alpha" });

    // Then
    expect(result.page.items.map((friend) => friend.user.userTag)).toEqual([
      "ALPHA001",
      "ALPHA003",
    ]);
    expect(result.totalCount).toBe(3);
  });
});
