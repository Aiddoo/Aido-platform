import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../../../friends/application/ports/follow-cache.port.js";
import { UserBlock, type UserBlockCreationPlan } from "../../domain/user-block.aggregate.js";
import { SocialBlockLogEvent } from "../blocks.log-events.js";
import { type UserBlockRepositoryPort } from "../ports/user-block.repository.port.js";

export interface BlockUserInput {
  readonly blockerId: string;
  readonly blockedId: string;
}

export interface BlockUserResult {
  readonly block: UserBlock;
  /** 이번 요청으로 새로 차단했으면 true. 이미 차단한 사용자면 false */
  readonly isNewlyBlocked: boolean;
}

interface BlockUserDependencies {
  readonly userBlockRepository: Pick<
    UserBlockRepositoryPort,
    "userExists" | "findByPair" | "create" | "removeFriendshipsBetween"
  >;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly friendshipCache: FriendshipCacheInvalidator;
  readonly logger: ApplicationLoggerPort;
}

export class BlockUser {
  readonly #dependencies: BlockUserDependencies;

  constructor(dependencies: BlockUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: BlockUserInput): Promise<BlockUserResult> {
    const plan = UserBlock.planCreation({ ...input, createdAt: now() });

    const result = await this.#dependencies.unitOfWork.run(() => this.#block(plan));

    if (result.removedFriendshipCount > 0) {
      await invalidateFriendshipCaches(
        this.#dependencies.friendshipCache,
        input.blockerId,
        input.blockedId,
      );
    }
    if (result.isNewlyBlocked) {
      this.#dependencies.logger.log({
        event: SocialBlockLogEvent.BLOCKED,
        userId: input.blockerId,
        targetUserId: input.blockedId,
        removedFriendshipCount: result.removedFriendshipCount,
      });
    }
    return { block: result.block, isNewlyBlocked: result.isNewlyBlocked };
  }

  async #block(
    plan: UserBlockCreationPlan,
  ): Promise<BlockUserResult & { removedFriendshipCount: number }> {
    const { blockerId, blockedId } = plan;
    // 친구 요청·수락과 같은 쌍·목록 잠금을 잡아, 차단 직전에 시작한 요청이 차단 뒤에 친구 관계를 다시 만들지 못하게 한다.
    await this.#dependencies.mutationLock.acquire([
      MutationLockKeys.friendPair(blockerId, blockedId),
      MutationLockKeys.friendList(blockerId),
      MutationLockKeys.friendList(blockedId),
    ]);
    const isTargetActive = await this.#dependencies.userBlockRepository.userExists(blockedId);
    if (!isTargetActive) {
      throw new ApplicationException(ErrorCode.BLOCK_2202, { targetUserId: blockedId });
    }

    const existing = await this.#dependencies.userBlockRepository.findByPair(blockerId, blockedId);
    const block = existing ?? (await this.#dependencies.userBlockRepository.create(plan));
    const removedFriendshipCount =
      await this.#dependencies.userBlockRepository.removeFriendshipsBetween(blockerId, blockedId);
    return { block, isNewlyBlocked: existing == null, removedFriendshipCount };
  }
}
