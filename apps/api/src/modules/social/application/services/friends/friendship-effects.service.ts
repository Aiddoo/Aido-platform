import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import { type FollowNotifierPort } from "../../ports/friends/follow-notifier.port.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "./friendship-cache-invalidation.js";

interface FriendshipEffectsDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "countMutualFriends">;
  readonly cache: FriendshipCacheInvalidator;
  readonly notifier: Pick<FollowNotifierPort, "notifyFollowMutual" | "notifyFirstFriendMilestone">;
  readonly logger: ApplicationLoggerPort;
}

export class FriendshipEffects {
  readonly #dependencies: FriendshipEffectsDependencies;

  constructor(dependencies: FriendshipEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  invalidateFriendshipCaches(userId: string, targetUserId: string): Promise<void> {
    return invalidateFriendshipCaches(this.#dependencies.cache, userId, targetUserId);
  }

  /** 친구가 된 사실은 상대에게만 알린다. 수락이나 초대 입력을 직접 한 사람은 이미 화면에서 결과를 봤다 */
  notifyFriendshipEstablished(params: {
    actorId: string;
    actorName: string;
    counterpartId: string;
  }): void {
    this.#dependencies.notifier.notifyFollowMutual({
      userId: params.counterpartId,
      friendId: params.actorId,
      friendName: params.actorName,
    });
  }

  async checkFirstFriendMilestone(userId: string): Promise<void> {
    try {
      const count = await this.#dependencies.followRepository.countMutualFriends(userId);
      if (count === 1) {
        this.#dependencies.notifier.notifyFirstFriendMilestone({ userId });
      }
    } catch (error) {
      this.#dependencies.logger.error({
        event: SocialFriendLogEvent.MILESTONE_CHECK_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }
}
