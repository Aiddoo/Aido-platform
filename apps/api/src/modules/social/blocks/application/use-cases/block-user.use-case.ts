import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendLockKeys } from "../../../friends/application/friends.lock-keys.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../../../friends/application/ports/follow-cache.port.js";
import { UserBlock } from "../../domain/user-block.aggregate.js";
import { blockTargetNotFound } from "../blocks.errors.js";
import { BlockLogEvent } from "../blocks.log-events.js";
import type { UserBlockRepositoryPort } from "../ports/user-block.repository.port.js";

export interface BlockUserCommand {
  readonly blockerId: string;
  readonly blockedId: string;
}

export interface BlockUserDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly userBlockRepository: Pick<
    UserBlockRepositoryPort,
    "nextId" | "existsActiveUser" | "findByPair" | "removeFriendshipsBetween" | "save"
  >;
  readonly friendshipCache: FriendshipCacheInvalidator;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 이미 차단한 사용자를 다시 차단하면 처음 차단을 그대로 돌려준다
export class BlockUserUseCase {
  readonly #dependencies: BlockUserDependencies;

  constructor(dependencies: BlockUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: BlockUserCommand): Promise<UserBlock> {
    const { unitOfWork, mutationLock, userBlockRepository, friendshipCache, clock, logger } =
      this.#dependencies;
    const blockerId = UserId.reconstitute(command.blockerId);
    const blockedId = UserId.reconstitute(command.blockedId);
    // 자기 자신 차단은 잠금을 잡기 전에 거부한다
    const created = UserBlock.create({
      id: await userBlockRepository.nextId(),
      blockerId,
      blockedId,
      now: clock.now(),
    });

    const result = await unitOfWork.run(async () => {
      // 친구 요청·수락과 같은 쌍·목록 잠금을 잡아, 차단 직전에 시작한 요청이 차단 뒤에 친구 관계를 다시 만들지 못하게 한다
      await mutationLock.acquire([
        FriendLockKeys.pair(blockerId, blockedId),
        FriendLockKeys.list(blockerId),
        FriendLockKeys.list(blockedId),
      ]);
      if (!(await userBlockRepository.existsActiveUser(blockedId))) {
        throw blockTargetNotFound(blockedId);
      }

      const existing = await userBlockRepository.findByPair(blockerId, blockedId);
      if (existing == null) {
        await userBlockRepository.save(created);
      }
      const removedFriendshipCount = await userBlockRepository.removeFriendshipsBetween(
        blockerId,
        blockedId,
      );
      return {
        block: existing ?? created,
        isNewlyBlocked: existing == null,
        removedFriendshipCount,
      };
    });

    if (result.removedFriendshipCount > 0) {
      await invalidateFriendshipCaches(friendshipCache, blockerId, blockedId);
    }
    if (result.isNewlyBlocked) {
      logger.log({
        event: BlockLogEvent.BLOCKED,
        userId: command.blockerId,
        targetUserId: command.blockedId,
        removedFriendshipCount: result.removedFriendshipCount,
      });
    }
    return result.block;
  }
}
