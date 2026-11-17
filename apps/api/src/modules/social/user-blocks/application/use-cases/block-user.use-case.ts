import type { UserBriefReaderPort } from "#api/modules/identity/users/identity-users.public";
import type { CheerCountCachePort } from "#api/modules/social/cheers/social-cheers.public";
import {
  FriendshipLockKeys,
  type FriendshipSeverancePort,
} from "#api/modules/social/friendships/social-friendships.public";
import type { NudgeCountCachePort } from "#api/modules/social/nudges/social-nudges.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserBlockId } from "../../domain/user-block-id.vo.js";
import { UserBlock } from "../../domain/user-block.aggregate.js";
import type { UserBlockRepositoryPort } from "../ports/user-block.repository.port.js";
import { blockTargetNotFound } from "../user-blocks.errors.js";
import { UserBlockLogEvent } from "../user-blocks.log-events.js";

export interface BlockUserCommand {
  readonly blockerId: string;
  readonly blockedId: string;
}

export interface BlockUserDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly userBlockRepository: Pick<UserBlockRepositoryPort, "findByPair" | "save">;
  // 탈퇴·비활성 사용자는 차단 대상이 아니다
  readonly userBriefReader: Pick<UserBriefReaderPort, "existsActiveUser">;
  readonly friendshipSeverance: Pick<FriendshipSeverancePort, "severBetween">;
  // 차단한 상대의 콕·응원은 목록 수에서 빠진다
  readonly nudgeCountCache: Pick<NudgeCountCachePort, "invalidate">;
  readonly cheerCountCache: Pick<CheerCountCachePort, "invalidate">;
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
    const {
      unitOfWork,
      mutationLock,
      userBlockRepository,
      userBriefReader,
      friendshipSeverance,
      clock,
      logger,
    } = this.#dependencies;
    const blockerId = UserId.reconstitute(command.blockerId);
    const blockedId = UserId.reconstitute(command.blockedId);
    // 자기 자신 차단은 잠금을 잡기 전에 거부한다
    const created = UserBlock.create({
      id: UserBlockId.generate(),
      blockerId,
      blockedId,
      now: clock.now(),
    });

    const result = await unitOfWork.run(async () => {
      // 친구 요청·수락과 같은 쌍·목록 잠금을 잡아, 차단 직전에 시작한 요청이 차단 뒤에 친구 관계를 다시 만들지 못하게 한다
      await mutationLock.acquire([
        FriendshipLockKeys.pair(blockerId, blockedId),
        FriendshipLockKeys.list(blockerId),
        FriendshipLockKeys.list(blockedId),
      ]);
      if (!(await userBriefReader.existsActiveUser(blockedId))) {
        throw blockTargetNotFound(blockedId);
      }

      const existing = await userBlockRepository.findByPair(blockerId, blockedId);
      if (existing == null) {
        await userBlockRepository.save(created);
      }
      // 친구 관계 캐시는 friends가 커밋 뒤 비운다
      const removedFriendshipCount = await friendshipSeverance.severBetween(blockerId, blockedId);
      return {
        block: existing ?? created,
        isNewlyBlocked: existing == null,
        removedFriendshipCount,
      };
    });

    if (result.isNewlyBlocked) {
      await Promise.all([
        this.#dependencies.nudgeCountCache.invalidate([blockerId, blockedId]),
        this.#dependencies.cheerCountCache.invalidate([blockerId, blockedId]),
      ]);
      logger.log({
        event: UserBlockLogEvent.BLOCKED,
        userId: command.blockerId,
        targetUserId: command.blockedId,
        removedFriendshipCount: result.removedFriendshipCount,
      });
    }
    return result.block;
  }
}
