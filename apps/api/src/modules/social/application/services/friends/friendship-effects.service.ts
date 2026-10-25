import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

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
  readonly logger: ApplicationLogger;
}

export class FriendshipEffects {
  readonly #dependencies: FriendshipEffectsDependencies;

  constructor(dependencies: FriendshipEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  invalidateFriendshipCaches(userId: string, targetUserId: string): Promise<void> {
    return invalidateFriendshipCaches(this.#dependencies.cache, userId, targetUserId);
  }

  notifyMutual(params: { userId: string; friendId: string; friendName: string }): void {
    this.#dependencies.notifier.notifyFollowMutual(params);
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
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
