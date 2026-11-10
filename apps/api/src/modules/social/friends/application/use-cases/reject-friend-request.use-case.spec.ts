import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryFollowRepository } from "#test/doubles/social/in-memory-follow.repository";
import {
  createFriendshipFixture,
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import type { Friendship } from "../../domain/friendship.aggregate.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { RejectFriendRequestUseCase } from "./reject-friend-request.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const REQUESTER = FRIENDSHIP_FIXTURE_FRIEND_ID;
const OTHER = FRIENDSHIP_FIXTURE_OTHER_USER_ID;

function setup(friendships: readonly Friendship[]) {
  const followRepository = new InMemoryFollowRepository(friendships);
  const mutationLock = new RecordingMutationLock();
  const useCase = new RejectFriendRequestUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    followRepository,
    logger: new SilentLogger(),
  });
  return { useCase, followRepository, mutationLock };
}

describe("RejectFriendRequestUseCase — 친구 요청 거절", () => {
  it.each([
    { name: "받은 요청이 없으면", friendships: [] },
    {
      name: "이미 친구면",
      friendships: createMutualFriendshipFixtures({ userId: ME, friendId: REQUESTER }),
    },
  ])("$name FOLLOW_0903으로 거절하고 아무것도 지우지 않는다", async ({ friendships }) => {
    // Given
    const { useCase, followRepository } = setup(friendships);

    // When
    const result = useCase.execute({ userId: ME, requesterUserId: REQUESTER });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0903,
      details: { targetUserId: REQUESTER },
    });
    expect(followRepository.size).toBe(friendships.length);
  });

  it("받은 대기 요청만 지우고 다른 사람의 요청은 둔다", async () => {
    // Given
    const other = createFriendshipFixture({ followerId: OTHER, followingId: ME });
    const { useCase, followRepository, mutationLock } = setup([
      createFriendshipFixture({ followerId: REQUESTER, followingId: ME }),
      other,
    ]);

    // When
    await useCase.execute({ userId: ME, requesterUserId: REQUESTER });

    // Then
    expect(followRepository.listAll().map((friendship) => friendship.id.value)).toEqual([
      other.id.value,
    ]);
    expect(mutationLock.acquiredKeys).toEqual([
      [FriendLockKeys.pair(UserId.reconstitute(ME), UserId.reconstitute(REQUESTER))],
    ]);
  });
});
