import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
} from "../ports/follow.repository.port";
import { FOLLOW_CACHE, type FollowCachePort } from "../ports/follow-cache.port";
import {
	FOLLOW_NOTIFIER,
	type FollowNotifierPort,
} from "../ports/follow-notifier.port";

/**
 * FriendshipEffects — 친구 관계 성립/해제에 수반되는 부수효과 캡슐화.
 *
 * 세 write use-case(친구 요청 자동수락·수락·삭제)가 공유하는 캐시 무효화·알림·마일스톤
 * 로직을 한곳에 모은다. 알림 enqueue는 트랜잭션 커밋 후 fire-and-forget이며, 마일스톤 체크는
 * 실패를 삼켜 주 흐름을 막지 않는다(레거시 동작 보존).
 */
@Injectable()
export class FriendshipEffects {
	readonly #logger = new Logger(FriendshipEffects.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		@Inject(FOLLOW_CACHE)
		private readonly cache: FollowCachePort,
		@Inject(FOLLOW_NOTIFIER)
		private readonly notifier: FollowNotifierPort,
	) {}

	/** 두 사용자 간 친구 관계 캐시 일괄 무효화 (맞팔 여부·양측 맞팔 ID·양측 친구 수) */
	async invalidateFriendshipCaches(
		userId: string,
		targetUserId: string,
	): Promise<void> {
		await Promise.all([
			this.cache.invalidateMutualFriend(userId, targetUserId),
			this.cache.invalidateMutualFriendIds(userId),
			this.cache.invalidateMutualFriendIds(targetUserId),
			this.cache.invalidateFriendCount(userId),
			this.cache.invalidateFriendCount(targetUserId),
		]);
	}

	/** 양방향 맞팔 알림 enqueue */
	notifyMutual(params: {
		userId: string;
		friendId: string;
		friendName: string;
	}): void {
		this.notifier.notifyFollowMutual(params);
	}

	/**
	 * 첫 친구 마일스톤 체크 후 enqueue (친구 수가 정확히 1일 때).
	 * 실패는 로깅만 하고 삼킨다.
	 */
	async checkFirstFriendMilestone(userId: string): Promise<void> {
		try {
			const count = await this.followRepository.countMutualFriends(userId);
			if (count === 1) {
				this.notifier.notifyFirstFriendMilestone({ userId });
			}
		} catch (error) {
			this.#logger.error(
				`Failed to check first friend milestone: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
