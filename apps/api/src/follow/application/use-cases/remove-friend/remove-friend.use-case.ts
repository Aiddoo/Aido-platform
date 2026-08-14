import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from "../../ports/follow.repository.port";
import { FriendshipEffects } from "../../services/friendship-effects.service";

export interface RemoveFriendInput {
	userId: string;
	targetUserId: string;
}

/**
 * 친구 삭제 / 보낸 요청 철회 use-case.
 * 내 방향 관계를 삭제하고, 상대 방향 관계가 있으면 함께 삭제(양방향 정리)한다.
 */
@Injectable()
export class RemoveFriendUseCase {
	readonly #logger = new Logger(RemoveFriendUseCase.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly effects: FriendshipEffects,
	) {}

	async execute(input: RemoveFriendInput): Promise<void> {
		const { userId, targetUserId } = input;

		const myFollow = await this.followRepository.findByFollowerAndFollowing(userId, targetUserId);
		if (!myFollow) {
			throw new ApplicationException(ErrorCode.FOLLOW_0907, { targetUserId });
		}

		await this.uow.run(async () => {
			await this.followRepository.delete(myFollow.id);

			const theirFollow = await this.followRepository.findByFollowerAndFollowing(
				targetUserId,
				userId,
			);
			if (theirFollow) {
				await this.followRepository.delete(theirFollow.id);
			}
		});

		await this.effects.invalidateFriendshipCaches(userId, targetUserId);

		this.#logger.log(`Follow removed: ${userId} X ${targetUserId}`);
	}
}
