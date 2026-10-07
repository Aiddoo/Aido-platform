import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type FollowCachePort } from "../../ports/friends/follow-cache.port.js";
import { type FollowNotifierPort } from "../../ports/friends/follow-notifier.port.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";

/**
 * FriendshipEffects — 친구 관계 성립/해제에 수반되는 부수효과 캡슐화.
 *
 * 세 write use-case(친구 요청 자동수락·수락·삭제)가 공유하는 캐시 무효화·알림·마일스톤
 * 로직을 한곳에 모은다. 알림 enqueue는 트랜잭션 커밋 후 fire-and-forget이며, 마일스톤 체크는
 * 실패를 삼켜 주 흐름을 막지 않는다(레거시 동작 보존).
 */
interface FriendshipEffectsDependencies {
  readonly followRepository: FollowRepositoryPort;
  readonly cache: FollowCachePort;
  readonly notifier: FollowNotifierPort;
  readonly logger: ApplicationLogger;
}

export class FriendshipEffects {
  readonly #dependencies: FriendshipEffectsDependencies;

  constructor(dependencies: FriendshipEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  /** 두 사용자 간 친구 관계 캐시 일괄 무효화 (맞팔 여부·양측 맞팔 ID·양측 친구 수) */
  async invalidateFriendshipCaches(userId: string, targetUserId: string): Promise<void> {
    await Promise.all([
      this.#dependencies.cache.invalidateMutualFriend(userId, targetUserId),
      this.#dependencies.cache.invalidateMutualFriendIds(userId),
      this.#dependencies.cache.invalidateMutualFriendIds(targetUserId),
      this.#dependencies.cache.invalidateFriendCount(userId),
      this.#dependencies.cache.invalidateFriendCount(targetUserId),
    ]);
  }

  /** 양방향 맞팔 알림 enqueue */
  notifyMutual(params: { userId: string; friendId: string; friendName: string }): void {
    this.#dependencies.notifier.notifyFollowMutual(params);
  }

  /**
   * 첫 친구 마일스톤 체크 후 enqueue (친구 수가 정확히 1일 때).
   * 실패는 로깅만 하고 삼킨다.
   */
  async checkFirstFriendMilestone(userId: string): Promise<void> {
    try {
      const count = await this.#dependencies.followRepository.countMutualFriends(userId);
      if (count === 1) {
        this.#dependencies.notifier.notifyFirstFriendMilestone({ userId });
      }
    } catch (error) {
      this.#dependencies.logger.error(
        `Failed to check first friend milestone: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
