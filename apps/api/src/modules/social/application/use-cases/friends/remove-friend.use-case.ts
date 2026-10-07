import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import type { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";

export interface RemoveFriendInput {
  userId: string;
  targetUserId: string;
}

/**
 * 친구 삭제 / 보낸 요청 철회 use-case.
 * 내 방향 관계를 삭제하고, 상대 방향 관계가 있으면 함께 삭제(양방향 정리)한다.
 */
interface RemoveFriendDependencies {
  readonly followRepository: FollowRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly effects: FriendshipEffects;
  readonly logger: ApplicationLogger;
}

export class RemoveFriend {
  readonly #dependencies: RemoveFriendDependencies;

  constructor(dependencies: RemoveFriendDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RemoveFriendInput): Promise<void> {
    const { userId, targetUserId } = input;

    const myFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
      userId,
      targetUserId,
    );
    if (!myFollow) {
      throw new ApplicationException(ErrorCode.FOLLOW_0907, { targetUserId });
    }

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.followRepository.delete(myFollow.id);

      const theirFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        targetUserId,
        userId,
      );
      if (theirFollow) {
        await this.#dependencies.followRepository.delete(theirFollow.id);
      }
    });

    await this.#dependencies.effects.invalidateFriendshipCaches(userId, targetUserId);

    this.#dependencies.logger.log(`Follow removed: ${userId} X ${targetUserId}`);
  }
}
