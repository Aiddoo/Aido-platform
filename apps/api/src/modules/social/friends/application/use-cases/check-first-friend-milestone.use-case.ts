import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendLogEvent } from "../friends.log-events.js";
import type { FollowNotifierPort } from "../ports/follow-notifier.port.js";
import type { FollowRepositoryPort } from "../ports/follow.repository.port.js";

export interface CheckFirstFriendMilestoneCommand {
  readonly userIds: readonly string[];
}

export interface CheckFirstFriendMilestoneDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "countMutualFriends">;
  readonly notifier: Pick<FollowNotifierPort, "notifyFirstFriendMilestone">;
  readonly logger: Pick<ApplicationLoggerPort, "error">;
}

// 친구가 된 뒤 커밋 밖에서 부른다. 실패해도 친구 맺기 응답을 막지 않도록 기록만 남긴다
export class CheckFirstFriendMilestoneUseCase {
  readonly #dependencies: CheckFirstFriendMilestoneDependencies;

  constructor(dependencies: CheckFirstFriendMilestoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CheckFirstFriendMilestoneCommand): Promise<void> {
    await Promise.all(command.userIds.map((userId) => this.#check(userId)));
  }

  async #check(userId: string): Promise<void> {
    const { followRepository, notifier, logger } = this.#dependencies;
    try {
      const friendCount = await followRepository.countMutualFriends(UserId.reconstitute(userId));
      if (friendCount === 1) {
        notifier.notifyFirstFriendMilestone({ userId });
      }
    } catch (error) {
      logger.error({
        event: FriendLogEvent.MILESTONE_CHECK_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }
}
