import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeFriendshipCache } from "#test/doubles/social/fake-friendship-cache";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import {
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { MutualFriendReaderAdapter } from "./mutual-friend-reader.adapter.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const FRIEND = FRIENDSHIP_FIXTURE_FRIEND_ID;
const ME_ID = UserId.reconstitute(ME);
const FRIEND_ID = UserId.reconstitute(FRIEND);

function setup() {
  const friendshipRepository = new InMemoryFriendshipRepository();
  const profileReader = new InMemoryFriendProfileReader();
  profileReader.addUser({ id: ME, userTag: "MEME0001", name: "나" });
  profileReader.addUser({ id: FRIEND, userTag: "FRND0002" });
  const cache = new FakeFriendshipCache();
  const reader = new MutualFriendReaderAdapter(friendshipRepository, profileReader, cache);
  return { reader, friendshipRepository, cache };
}

async function befriend(friendshipRepository: InMemoryFriendshipRepository): Promise<void> {
  for (const friendship of createMutualFriendshipFixtures({ userId: ME, friendId: FRIEND })) {
    await friendshipRepository.save(friendship);
  }
}

describe("MutualFriendReaderAdapter — 다른 slice·Context가 보는 친구 판정", () => {
  it("맞팔 아님 캐시는 두 방향 조회에 함께 쓰고 무효화한 뒤에는 다시 읽는다", async () => {
    // Given
    const { reader, friendshipRepository, cache } = setup();
    const isFriendBefore = await reader.isMutualFriend(ME_ID, FRIEND_ID);
    await befriend(friendshipRepository);

    // When
    const isFriendCached = await reader.isMutualFriend(FRIEND_ID, ME_ID);
    await cache.invalidateMutualFriend(ME_ID, FRIEND_ID);
    const isFriendAfter = await reader.isMutualFriend(FRIEND_ID, ME_ID);

    // Then
    expect([isFriendBefore, isFriendCached, isFriendAfter]).toEqual([false, false, true]);
  });

  it("친구 수·id 목록은 캐시를 쓰고 권한을 판단하는 current 경로는 지금 관계를 읽는다", async () => {
    // Given
    const { reader, friendshipRepository } = setup();
    await reader.countFriends(ME_ID);
    await reader.getMutualFriendIds(ME_ID);
    await befriend(friendshipRepository);

    // When
    const cached = [await reader.countFriends(ME_ID), await reader.getMutualFriendIds(ME_ID)];
    const current = [
      await reader.countCurrentFriends(ME_ID),
      await reader.getCurrentMutualFriendIds(ME_ID),
      await reader.isCurrentMutualFriend(ME_ID, FRIEND_ID),
    ];

    // Then
    expect(cached).toEqual([0, []]);
    expect(current).toEqual([1, [FRIEND], true]);
  });

  it("표시 이름은 프로필 이름, 없으면 Aido ID(userTag)다", async () => {
    // Given
    const { reader } = setup();

    // When
    const names = [
      await reader.getUserDisplayName(ME_ID),
      await reader.getUserDisplayName(FRIEND_ID),
    ];

    // Then
    expect(names).toEqual(["나", "FRND0002"]);
  });

  it("사용자 행이 없으면 userId를 이름으로 쓰지 않고 SYS_0001로 거절한다", async () => {
    // Given
    const { reader } = setup();

    // When
    const reading = reader.getUserDisplayName(UserId.reconstitute("missing"));

    // Then
    await expect(reading).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0001,
      details: { userId: "missing" },
    });
  });
});
