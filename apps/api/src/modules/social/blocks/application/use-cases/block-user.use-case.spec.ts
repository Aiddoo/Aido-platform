import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { FakeFollowCache } from "#test/doubles/social/fake-follow-cache";
import { InMemoryUserBlockRepository } from "#test/doubles/social/in-memory-user-block.repository";
import {
  createUserBlockFixture,
  USER_BLOCK_FIXTURE_BLOCKED_ID,
  USER_BLOCK_FIXTURE_BLOCKER_ID,
  USER_BLOCK_FIXTURE_NOW,
} from "#test/fixtures/social/user-block.fixture";

import { FriendLockKeys } from "../../../friends/application/friends.lock-keys.js";
import { BlockLogEvent } from "../blocks.log-events.js";
import { type BlockUserDependencies, BlockUserUseCase } from "./block-user.use-case.js";

const BLOCKER_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKER_ID);
const BLOCKED_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKED_ID);
const NOW = USER_BLOCK_FIXTURE_NOW.add({ hours: 1 });
const COMMAND = {
  blockerId: USER_BLOCK_FIXTURE_BLOCKER_ID,
  blockedId: USER_BLOCK_FIXTURE_BLOCKED_ID,
};

function createRepository(
  params: ConstructorParameters<typeof InMemoryUserBlockRepository>[0] = {},
): InMemoryUserBlockRepository {
  return new InMemoryUserBlockRepository({
    activeUserIds: [USER_BLOCK_FIXTURE_BLOCKER_ID, USER_BLOCK_FIXTURE_BLOCKED_ID],
    ...params,
  });
}

function createBlockUserUseCase(overrides: Partial<BlockUserDependencies> = {}) {
  return new BlockUserUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    userBlockRepository: createRepository(),
    friendshipCache: new FakeFollowCache(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("BlockUserUseCase — 사용자 차단", () => {
  it("친구를 차단하면 쌍·목록 잠금 안에서 저장하고 친구 관계와 두 사람의 친구 캐시를 지운다", async () => {
    // Given
    const userBlockRepository = createRepository();
    userBlockRepository.seedFollow(USER_BLOCK_FIXTURE_BLOCKER_ID, USER_BLOCK_FIXTURE_BLOCKED_ID);
    userBlockRepository.seedFollow(USER_BLOCK_FIXTURE_BLOCKED_ID, USER_BLOCK_FIXTURE_BLOCKER_ID);
    const friendshipCache = new FakeFollowCache();
    const mutationLock = new RecordingMutationLock();
    const logger = new SilentLogger();
    const useCase = createBlockUserUseCase({
      userBlockRepository,
      friendshipCache,
      mutationLock,
      logger,
    });

    // When
    const block = await useCase.execute(COMMAND);

    // Then
    expect(block.toPrimitives()).toEqual({
      id: block.id.value,
      blockerId: USER_BLOCK_FIXTURE_BLOCKER_ID,
      blockedId: USER_BLOCK_FIXTURE_BLOCKED_ID,
      createdAt: NOW,
    });
    expect((await userBlockRepository.findByPair(BLOCKER_ID, BLOCKED_ID))?.toPrimitives()).toEqual(
      block.toPrimitives(),
    );
    expect(userBlockRepository.followCount).toBe(0);
    expect(friendshipCache.invalidated.toSorted()).toEqual(
      [
        `mutual:${USER_BLOCK_FIXTURE_BLOCKER_ID}:${USER_BLOCK_FIXTURE_BLOCKED_ID}`,
        `ids:${USER_BLOCK_FIXTURE_BLOCKER_ID}`,
        `ids:${USER_BLOCK_FIXTURE_BLOCKED_ID}`,
        `count:${USER_BLOCK_FIXTURE_BLOCKER_ID}`,
        `count:${USER_BLOCK_FIXTURE_BLOCKED_ID}`,
      ].toSorted(),
    );
    expect(mutationLock.acquiredKeys).toEqual([
      [
        FriendLockKeys.pair(BLOCKER_ID, BLOCKED_ID),
        FriendLockKeys.list(BLOCKER_ID),
        FriendLockKeys.list(BLOCKED_ID),
      ],
    ]);
    expect(logger.messages).toEqual([
      {
        event: BlockLogEvent.BLOCKED,
        userId: USER_BLOCK_FIXTURE_BLOCKER_ID,
        targetUserId: USER_BLOCK_FIXTURE_BLOCKED_ID,
        removedFriendshipCount: 2,
      },
    ]);
  });

  it("친구 관계가 없으면 친구 캐시를 비우지 않는다", async () => {
    // Given
    const friendshipCache = new FakeFollowCache();
    const useCase = createBlockUserUseCase({ friendshipCache });

    // When
    await useCase.execute(COMMAND);

    // Then
    expect(friendshipCache.invalidated).toEqual([]);
  });

  it("이미 차단한 사용자를 다시 차단하면 처음 차단을 돌려주고 새로 저장하거나 로그를 남기지 않는다", async () => {
    // Given
    const first = createUserBlockFixture();
    const userBlockRepository = createRepository({ blocks: [first] });
    const logger = new SilentLogger();
    const useCase = createBlockUserUseCase({ userBlockRepository, logger });

    // When
    const block = await useCase.execute(COMMAND);

    // Then
    expect(block.toPrimitives()).toEqual(first.toPrimitives());
    expect(userBlockRepository.size).toBe(1);
    expect(logger.messages).toEqual([]);
  });

  it("탈퇴했거나 없는 사용자는 BLOCK_2202로 거부하고 저장하지 않는다", async () => {
    // Given
    const userBlockRepository = createRepository({
      activeUserIds: [USER_BLOCK_FIXTURE_BLOCKER_ID],
    });
    const useCase = createBlockUserUseCase({ userBlockRepository });

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.BLOCK_2202,
      details: { targetUserId: USER_BLOCK_FIXTURE_BLOCKED_ID },
    });
    expect(userBlockRepository.size).toBe(0);
  });

  it("자기 자신은 잠금을 잡기 전에 BLOCK_2201로 거부한다", async () => {
    // Given
    const mutationLock = new RecordingMutationLock();
    const useCase = createBlockUserUseCase({ mutationLock });

    // When
    const result = useCase.execute({
      blockerId: USER_BLOCK_FIXTURE_BLOCKER_ID,
      blockedId: USER_BLOCK_FIXTURE_BLOCKER_ID,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.BLOCK_2201 });
    expect(mutationLock.acquiredKeys).toEqual([]);
  });
});
