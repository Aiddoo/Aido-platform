import { FriendLockKeys } from "#api/modules/social/friends/social-friends.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryUserBlockRepository } from "#test/doubles/social/in-memory-user-block.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  createUserBlockFixture,
  USER_BLOCK_FIXTURE_BLOCKED_ID,
  USER_BLOCK_FIXTURE_BLOCKER_ID,
} from "#test/fixtures/social/user-block.fixture";

import { BlockLogEvent } from "../blocks.log-events.js";
import { type UnblockUserDependencies, UnblockUserUseCase } from "./unblock-user.use-case.js";

const BLOCKER_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKER_ID);
const BLOCKED_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKED_ID);

function createUnblockUserUseCase(overrides: Partial<UnblockUserDependencies> = {}) {
  return new UnblockUserUseCase({
    nudgeCountCache: new PassThroughCountCache(),
    cheerCountCache: new PassThroughCountCache(),
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    userBlockRepository: new InMemoryUserBlockRepository(),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("UnblockUserUseCase — 차단 해제", () => {
  it("쌍 잠금 안에서 내 차단을 지우고 두 사람의 콕·응원 수 캐시를 버리며 로그를 남긴다", async () => {
    // Given
    const userBlockRepository = new InMemoryUserBlockRepository({
      blocks: [createUserBlockFixture()],
    });
    const mutationLock = new RecordingMutationLock();
    const logger = new SilentLogger();
    const countCache = new PassThroughCountCache();
    const useCase = createUnblockUserUseCase({
      userBlockRepository,
      mutationLock,
      logger,
      nudgeCountCache: countCache,
      cheerCountCache: countCache,
    });

    // When
    await useCase.execute({
      blockerId: USER_BLOCK_FIXTURE_BLOCKER_ID,
      blockedId: USER_BLOCK_FIXTURE_BLOCKED_ID,
    });

    // Then
    expect(await userBlockRepository.findByPair(BLOCKER_ID, BLOCKED_ID)).toBeNull();
    expect(mutationLock.acquiredKeys).toEqual([[FriendLockKeys.pair(BLOCKER_ID, BLOCKED_ID)]]);
    expect(logger.messages).toEqual([
      {
        event: BlockLogEvent.UNBLOCKED,
        userId: USER_BLOCK_FIXTURE_BLOCKER_ID,
        targetUserId: USER_BLOCK_FIXTURE_BLOCKED_ID,
      },
    ]);
    expect(countCache.invalidatedUserIds).toHaveLength(4);
  });

  it("상대가 나를 차단한 기록은 내가 해제할 수 없고 성공으로 끝내며 로그를 남기지 않는다", async () => {
    // Given
    const userBlockRepository = new InMemoryUserBlockRepository({
      blocks: [createUserBlockFixture()],
    });
    const logger = new SilentLogger();
    const useCase = createUnblockUserUseCase({ userBlockRepository, logger });

    // When
    await useCase.execute({
      blockerId: USER_BLOCK_FIXTURE_BLOCKED_ID,
      blockedId: USER_BLOCK_FIXTURE_BLOCKER_ID,
    });

    // Then
    expect(userBlockRepository.size).toBe(1);
    expect(logger.messages).toEqual([]);
  });
});
