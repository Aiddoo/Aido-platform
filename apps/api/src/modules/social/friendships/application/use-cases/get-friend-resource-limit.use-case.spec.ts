import { FakeFriendshipCache } from "#test/doubles/social/fake-friendship-cache";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import { StubFriendLimitReader } from "#test/doubles/social/stub-friend-limit-reader";
import {
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { MutualFriendReaderAdapter } from "../../infrastructure/adapters/mutual-friend-reader.adapter.js";
import { GetFriendResourceLimitUseCase } from "./get-friend-resource-limit.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;

describe("GetFriendResourceLimitUseCase — 친구 보유 한도", () => {
  it.each([
    { name: "무료", maxFriendCount: 5 },
    { name: "무제한", maxFriendCount: null },
  ])("$name 사용자는 맞팔 친구 수와 자기 한도를 받는다", async ({ maxFriendCount }) => {
    // Given
    const friendshipRepository = new InMemoryFriendshipRepository(
      createMutualFriendshipFixtures({ userId: ME, friendId: FRIENDSHIP_FIXTURE_FRIEND_ID }),
    );
    const limitReader = new StubFriendLimitReader();
    limitReader.setMaxFriendCount(ME, maxFriendCount);
    const useCase = new GetFriendResourceLimitUseCase({
      mutualFriendReader: new MutualFriendReaderAdapter(
        friendshipRepository,
        new InMemoryFriendProfileReader(),
        new FakeFriendshipCache(),
      ),
      limitReader,
    });

    // When
    const result = await useCase.execute({ userId: ME });

    // Then
    expect(result).toEqual({ friendCount: 1, maxCount: maxFriendCount });
  });
});
