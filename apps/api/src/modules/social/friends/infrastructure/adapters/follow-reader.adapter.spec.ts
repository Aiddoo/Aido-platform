import { FakeFollowCache } from "#test/doubles/social/fake-follow-cache";
import { InMemoryFollowRepository } from "#test/doubles/social/in-memory-follow.repository";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import {
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { FollowReaderAdapter } from "./follow-reader.adapter.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const FRIEND = FRIENDSHIP_FIXTURE_FRIEND_ID;

function setup() {
  const followRepository = new InMemoryFollowRepository();
  const profileReader = new InMemoryFriendProfileReader();
  profileReader.addUser({ id: ME, userTag: "MEME0001", name: "나" });
  profileReader.addUser({ id: FRIEND, userTag: "FRND0002" });
  const cache = new FakeFollowCache();
  const reader = new FollowReaderAdapter(followRepository, profileReader, cache);
  return { reader, followRepository, cache };
}

async function befriend(followRepository: InMemoryFollowRepository): Promise<void> {
  for (const friendship of createMutualFriendshipFixtures({ userId: ME, friendId: FRIEND })) {
    await followRepository.save(friendship);
  }
}

describe("FollowReaderAdapter — 다른 Context가 보는 친구 판정", () => {
  it("맞팔 아님 캐시는 두 방향 조회에 함께 쓰고 무효화한 뒤에는 다시 읽는다", async () => {
    // Given
    const { reader, followRepository, cache } = setup();
    const isFriendBefore = await reader.isMutualFriend(ME, FRIEND);
    await befriend(followRepository);

    // When
    const isFriendCached = await reader.isMutualFriend(FRIEND, ME);
    await cache.invalidateMutualFriend(ME, FRIEND);
    const isFriendAfter = await reader.isMutualFriend(FRIEND, ME);

    // Then
    expect([isFriendBefore, isFriendCached, isFriendAfter]).toEqual([false, false, true]);
  });

  it("친구 수·id 목록은 캐시를 쓰고 권한을 판단하는 current 경로는 지금 관계를 읽는다", async () => {
    // Given
    const { reader, followRepository } = setup();
    await reader.countFriends(ME);
    await reader.getMutualFriendIds(ME);
    await befriend(followRepository);

    // When
    const cached = [await reader.countFriends(ME), await reader.getMutualFriendIds(ME)];
    const current = [
      await reader.countCurrentFriends(ME),
      await reader.getCurrentMutualFriendIds(ME),
      await reader.isCurrentMutualFriend(ME, FRIEND),
    ];

    // Then
    expect(cached).toEqual([0, []]);
    expect(current).toEqual([1, [FRIEND], true]);
  });

  it("표시 이름은 프로필 이름, 없으면 태그, 사용자가 없으면 id다", async () => {
    // Given
    const { reader } = setup();

    // When
    const names = await Promise.all([
      reader.getUserDisplayName(ME),
      reader.getUserDisplayName(FRIEND),
      reader.getUserDisplayName("missing"),
    ]);

    // Then
    expect(names).toEqual(["나", "FRND0002", "missing"]);
  });
});
