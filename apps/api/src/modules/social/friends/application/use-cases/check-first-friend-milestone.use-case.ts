import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FollowNotifierPort } from "../ports/follow-notifier.port.js";
import type { FollowRepositoryPort } from "../ports/follow.repository.port.js";

export interface CheckFirstFriendMilestoneCommand {
  readonly userIds: readonly string[];
}

export interface CheckFirstFriendMilestoneDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "countMutualFriends">;
  readonly notifier: Pick<FollowNotifierPort, "notifyFirstFriendMilestone">;
}

// 친구 관계를 저장한 트랜잭션 안에서 부른다. 알림 작업이 그 변경과 함께 커밋된다
export class CheckFirstFriendMilestoneUseCase {
  readonly #dependencies: CheckFirstFriendMilestoneDependencies;

  constructor(dependencies: CheckFirstFriendMilestoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CheckFirstFriendMilestoneCommand): Promise<void> {
    const { followRepository, notifier } = this.#dependencies;
    for (const userId of command.userIds) {
      const friendCount = await followRepository.countMutualFriends(UserId.reconstitute(userId));
      if (friendCount === 1) {
        await notifier.notifyFirstFriendMilestone({ userId });
      }
    }
  }
}
