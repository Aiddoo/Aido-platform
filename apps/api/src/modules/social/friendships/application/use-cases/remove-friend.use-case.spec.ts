import { ErrorCode } from "@aido/api/errors";

import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { FakeFriendshipCache } from "#test/doubles/social/fake-friendship-cache";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import {
  createFriendshipFixture,
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import type { Friendship } from "../../domain/friendship.aggregate.js";
import { RemoveFriendUseCase } from "./remove-friend.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const FRIEND = FRIENDSHIP_FIXTURE_FRIEND_ID;

// 작업은 바로 돌리되 release 전까지 "커밋"을 미뤄 커밋 뒤 작업 순서를 볼 수 있게 한다
class GatedUnitOfWork extends UnitOfWorkPort {
  readonly entered = Promise.withResolvers<void>();
  readonly released = Promise.withResolvers<void>();

  async run<T>(work: () => Promise<T>): Promise<T> {
    const result = await work();
    this.entered.resolve();
    await this.released.promise;
    return result;
  }
}

function setup(
  friendships: readonly Friendship[],
  unitOfWork: UnitOfWorkPort = new ImmediateUnitOfWork(),
) {
  const friendshipRepository = new InMemoryFriendshipRepository(friendships);
  const cache = new FakeFriendshipCache();
  const useCase = new RemoveFriendUseCase({
    unitOfWork,
    mutationLock: new RecordingMutationLock(),
    friendshipRepository,
    cache,
    logger: new SilentLogger(),
  });
  return { useCase, friendshipRepository, cache };
}

describe("RemoveFriendUseCase — 친구 삭제·요청 철회", () => {
  it("내 방향 관계가 없으면 FOLLOW_0907로 거절하고 상대가 보낸 요청은 둔다", async () => {
    // Given
    const { useCase, friendshipRepository } = setup([
      createFriendshipFixture({ followerId: FRIEND, followingId: ME }),
    ]);

    // When
    const result = useCase.execute({ userId: ME, targetUserId: FRIEND });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0907,
      details: { targetUserId: FRIEND },
    });
    expect(friendshipRepository.size).toBe(1);
  });

  it.each([
    { name: "친구", friendships: createMutualFriendshipFixtures({ userId: ME, friendId: FRIEND }) },
    {
      name: "보낸 요청",
      friendships: [createFriendshipFixture({ followerId: ME, followingId: FRIEND })],
    },
  ])("$name 관계를 두 방향 모두 지우고 두 사람의 친구 캐시를 비운다", async ({ friendships }) => {
    // Given
    const { useCase, friendshipRepository, cache } = setup(friendships);
    cache.mutual.set(`${ME}:${FRIEND}`, true);
    cache.friendCounts.set(ME, 1);
    cache.friendIds.set(FRIEND, [ME]);

    // When
    await useCase.execute({ userId: ME, targetUserId: FRIEND });

    // Then
    expect(friendshipRepository.size).toBe(0);
    expect(cache.mutual.size).toBe(0);
    expect(cache.friendCounts.size).toBe(0);
    expect(cache.friendIds.size).toBe(0);
  });

  it("UoW가 끝나기 전에는 친구 캐시를 비우지 않는다", async () => {
    // Given
    const unitOfWork = new GatedUnitOfWork();
    const { useCase, cache } = setup(
      createMutualFriendshipFixtures({ userId: ME, friendId: FRIEND }),
      unitOfWork,
    );
    cache.friendCounts.set(ME, 1);

    // When
    const execution = useCase.execute({ userId: ME, targetUserId: FRIEND });
    await unitOfWork.entered.promise;
    const countBeforeCommit = cache.friendCounts.get(ME);
    unitOfWork.released.resolve();
    await execution;

    // Then
    expect(countBeforeCommit).toBe(1);
    expect(cache.friendCounts.has(ME)).toBe(false);
  });
});
