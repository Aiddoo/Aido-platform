import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import type { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";

export interface RemoveFriendInput {
  readonly userId: string;
  readonly targetUserId: string;
}

interface RemoveFriendDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "findByFollowerAndFollowing" | "delete">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly effects: Pick<FriendshipEffects, "invalidateFriendshipCaches">;
  readonly logger: ApplicationLogger;
}

export class RemoveFriend {
  readonly #dependencies: RemoveFriendDependencies;

  constructor(dependencies: RemoveFriendDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RemoveFriendInput): Promise<void> {
    const { userId, targetUserId } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.friendPair(userId, targetUserId),
        MutationLockKeys.friendList(userId),
        MutationLockKeys.friendList(targetUserId),
      ]);
      const myFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        userId,
        targetUserId,
      );
      if (myFollow === null) {
        throw new ApplicationException(ErrorCode.FOLLOW_0907, { targetUserId });
      }

      await this.#dependencies.followRepository.delete(myFollow.id);

      const theirFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        targetUserId,
        userId,
      );
      if (theirFollow !== null) {
        await this.#dependencies.followRepository.delete(theirFollow.id);
      }
    });

    await this.#dependencies.effects.invalidateFriendshipCaches(userId, targetUserId);

    this.#dependencies.logger.log({ event: SocialFriendLogEvent.REMOVED, userId, targetUserId });
  }
}
