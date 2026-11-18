import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { friendshipNotFound } from "../friendships.errors.js";
import { FriendshipLockKeys } from "../friendships.lock-keys.js";
import { FriendshipLogEvent } from "../friendships.log-events.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../ports/friendship-cache.port.js";
import type { FriendshipRepositoryPort } from "../ports/friendship.repository.port.js";

export interface RemoveFriendCommand {
  readonly userId: string;
  readonly targetUserId: string;
}

export interface RemoveFriendDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly friendshipRepository: Pick<
    FriendshipRepositoryPort,
    "findByFollowerAndFollowing" | "delete"
  >;
  readonly cache: FriendshipCacheInvalidator;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 친구면 두 방향을 모두 지우고, 내가 보낸 요청뿐이면 그 요청을 철회한다
export class RemoveFriendUseCase {
  readonly #dependencies: RemoveFriendDependencies;

  constructor(dependencies: RemoveFriendDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RemoveFriendCommand): Promise<void> {
    const { unitOfWork, mutationLock, friendshipRepository, cache, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const targetUserId = UserId.reconstitute(command.targetUserId);

    await unitOfWork.run(async () => {
      await mutationLock.acquire([
        FriendshipLockKeys.pair(userId, targetUserId),
        FriendshipLockKeys.list(userId),
        FriendshipLockKeys.list(targetUserId),
      ]);
      const mine = await friendshipRepository.findByFollowerAndFollowing(userId, targetUserId);
      if (mine == null) {
        throw friendshipNotFound(targetUserId);
      }
      await friendshipRepository.delete(mine);

      const theirs = await friendshipRepository.findByFollowerAndFollowing(targetUserId, userId);
      if (theirs != null) {
        await friendshipRepository.delete(theirs);
      }
    });

    await invalidateFriendshipCaches(cache, userId, targetUserId);
    logger.log({
      event: FriendshipLogEvent.REMOVED,
      userId: command.userId,
      targetUserId: command.targetUserId,
    });
  }
}
