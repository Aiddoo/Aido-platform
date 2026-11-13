import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CheerCountCachePort } from "../../../cheers/application/ports/cheer-count-cache.port.js";
import { FriendLockKeys } from "../../../friends/application/friends.lock-keys.js";
import type { NudgeCountCachePort } from "../../../nudges/application/ports/nudge-count-cache.port.js";
import { BlockLogEvent } from "../blocks.log-events.js";
import type { UserBlockRepositoryPort } from "../ports/user-block.repository.port.js";

export interface UnblockUserCommand {
  readonly blockerId: string;
  readonly blockedId: string;
}

export interface UnblockUserDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly userBlockRepository: Pick<UserBlockRepositoryPort, "findByPair" | "delete">;
  // 차단이 풀리면 상대의 콕·응원이 목록 수에 다시 들어온다
  readonly nudgeCountCache: Pick<NudgeCountCachePort, "invalidate">;
  readonly cheerCountCache: Pick<CheerCountCachePort, "invalidate">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 끊긴 친구 관계는 되살리지 않는다. 없던 차단을 해제해도 성공이다
export class UnblockUserUseCase {
  readonly #dependencies: UnblockUserDependencies;

  constructor(dependencies: UnblockUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: UnblockUserCommand): Promise<void> {
    const { unitOfWork, mutationLock, userBlockRepository, logger } = this.#dependencies;
    const blockerId = UserId.reconstitute(command.blockerId);
    const blockedId = UserId.reconstitute(command.blockedId);

    const removed = await unitOfWork.run(async () => {
      await mutationLock.acquire([FriendLockKeys.pair(blockerId, blockedId)]);
      const block = await userBlockRepository.findByPair(blockerId, blockedId);
      if (block != null) {
        await userBlockRepository.delete(block);
      }
      return block;
    });

    if (removed != null) {
      await Promise.all([
        this.#dependencies.nudgeCountCache.invalidate([blockerId, blockedId]),
        this.#dependencies.cheerCountCache.invalidate([blockerId, blockedId]),
      ]);
      logger.log({
        event: BlockLogEvent.UNBLOCKED,
        userId: command.blockerId,
        targetUserId: command.blockedId,
      });
    }
  }
}
