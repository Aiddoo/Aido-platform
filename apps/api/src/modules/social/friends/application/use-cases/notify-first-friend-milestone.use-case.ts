import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendshipNotifierPort } from "../ports/friendship-notifier.port.js";
import type { FriendshipRepositoryPort } from "../ports/friendship.repository.port.js";

export interface NotifyFirstFriendMilestoneCommand {
  readonly userIds: readonly string[];
}

export interface NotifyFirstFriendMilestoneDependencies {
  readonly friendshipRepository: Pick<FriendshipRepositoryPort, "countMutualFriends">;
  readonly notifier: Pick<FriendshipNotifierPort, "notifyFirstFriendMilestone">;
}

// 친구 관계를 저장한 트랜잭션 안에서 부른다. 알림 작업이 그 변경과 함께 커밋된다
export class NotifyFirstFriendMilestoneUseCase {
  readonly #dependencies: NotifyFirstFriendMilestoneDependencies;

  constructor(dependencies: NotifyFirstFriendMilestoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: NotifyFirstFriendMilestoneCommand): Promise<void> {
    const { friendshipRepository, notifier } = this.#dependencies;
    for (const userId of command.userIds) {
      const friendCount = await friendshipRepository.countMutualFriends(
        UserId.reconstitute(userId),
      );
      if (friendCount === 1) {
        await notifier.notifyFirstFriendMilestone({ userId });
      }
    }
  }
}
