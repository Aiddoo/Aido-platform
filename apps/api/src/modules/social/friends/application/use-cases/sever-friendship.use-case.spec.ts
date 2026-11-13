import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { FakeFriendshipCache } from "#test/doubles/social/fake-friendship-cache";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import {
  createFriendshipFixture,
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { FriendLockKeys } from "../friends.lock-keys.js";
import { SeverFriendshipUseCase } from "./sever-friendship.use-case.js";

const USER_ID = UserId.reconstitute(FRIENDSHIP_FIXTURE_USER_ID);
const FRIEND_ID = UserId.reconstitute(FRIENDSHIP_FIXTURE_FRIEND_ID);
const COMMAND = { userId: FRIENDSHIP_FIXTURE_USER_ID, otherUserId: FRIENDSHIP_FIXTURE_FRIEND_ID };

function setup(friendshipRepository = new InMemoryFriendshipRepository()) {
  const afterCommit = new RecordingAfterCommitRegistry();
  const cache = new FakeFriendshipCache();
  const mutationLock = new RecordingMutationLock();
  const useCase = new SeverFriendshipUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    afterCommit,
    friendshipRepository,
    cache,
  });
  return { useCase, friendshipRepository, afterCommit, cache, mutationLock };
}

describe("SeverFriendshipUseCase", () => {
  it("두 사람 사이 두 방향 관계를 상태와 상관없이 지우고 커밋 뒤 두 사람의 친구 캐시를 비운다", async () => {
    // Given
    const { useCase, friendshipRepository, afterCommit, cache, mutationLock } = setup(
      new InMemoryFriendshipRepository([
        ...createMutualFriendshipFixtures({
          userId: FRIENDSHIP_FIXTURE_USER_ID,
          friendId: FRIENDSHIP_FIXTURE_FRIEND_ID,
        }),
        createFriendshipFixture({ followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID }),
      ]),
    );

    // When
    const removedCount = await useCase.execute(COMMAND);
    const invalidatedBeforeCommit = [...cache.invalidated];
    await afterCommit.runAll();

    // Then
    expect(removedCount).toBe(2);
    expect(
      friendshipRepository.listAll().map((friendship) => friendship.followingId.value),
    ).toEqual([FRIENDSHIP_FIXTURE_OTHER_USER_ID]);
    expect(invalidatedBeforeCommit).toEqual([]);
    expect(cache.invalidated.toSorted()).toEqual(
      [
        `mutual:${FRIENDSHIP_FIXTURE_USER_ID}:${FRIENDSHIP_FIXTURE_FRIEND_ID}`,
        `ids:${FRIENDSHIP_FIXTURE_USER_ID}`,
        `ids:${FRIENDSHIP_FIXTURE_FRIEND_ID}`,
        `count:${FRIENDSHIP_FIXTURE_USER_ID}`,
        `count:${FRIENDSHIP_FIXTURE_FRIEND_ID}`,
      ].toSorted(),
    );
    expect(mutationLock.acquiredKeys).toEqual([
      [
        FriendLockKeys.pair(USER_ID, FRIEND_ID),
        FriendLockKeys.list(USER_ID),
        FriendLockKeys.list(FRIEND_ID),
      ],
    ]);
  });

  it("두 사람 사이 관계가 없으면 0을 돌려주고 캐시를 비우지 않는다", async () => {
    // Given
    const { useCase, afterCommit } = setup();

    // When
    const removedCount = await useCase.execute(COMMAND);

    // Then
    expect(removedCount).toBe(0);
    expect(afterCommit.tasks).toEqual([]);
  });
});
