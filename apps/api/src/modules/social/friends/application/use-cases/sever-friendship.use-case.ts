import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendLockKeys } from "../friends.lock-keys.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../ports/friendship-cache.port.js";
import type { FriendshipRepositoryPort } from "../ports/friendship.repository.port.js";

export interface SeverFriendshipCommand {
  readonly userId: string;
  readonly otherUserId: string;
}

export interface SeverFriendshipDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly friendshipRepository: Pick<
    FriendshipRepositoryPort,
    "findByFollowerAndFollowing" | "delete"
  >;
  readonly cache: FriendshipCacheInvalidator;
}

// 차단처럼 두 사람 사이를 끊을 때 두 방향 관계를 상태와 상관없이 지우고 지운 수를 돌려준다. 호출자 UoW에 참여한다
export class SeverFriendshipUseCase {
  readonly #dependencies: SeverFriendshipDependencies;

  constructor(dependencies: SeverFriendshipDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SeverFriendshipCommand): Promise<number> {
    const { unitOfWork, mutationLock, afterCommit, friendshipRepository, cache } =
      this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const otherUserId = UserId.reconstitute(command.otherUserId);

    return unitOfWork.run(async () => {
      // 친구 요청·수락과 같은 잠금이다. 호출자가 이미 잡았으면 같은 트랜잭션이라 다시 기다리지 않는다
      await mutationLock.acquire([
        FriendLockKeys.pair(userId, otherUserId),
        FriendLockKeys.list(userId),
        FriendLockKeys.list(otherUserId),
      ]);
      let removedCount = 0;
      for (const [followerId, followingId] of [
        [userId, otherUserId],
        [otherUserId, userId],
      ] as const) {
        const friendship = await friendshipRepository.findByFollowerAndFollowing(
          followerId,
          followingId,
        );
        if (friendship != null) {
          await friendshipRepository.delete(friendship);
          removedCount += 1;
        }
      }

      if (removedCount > 0) {
        afterCommit.register(() => invalidateFriendshipCaches(cache, userId, otherUserId));
      }
      return removedCount;
    });
  }
}
