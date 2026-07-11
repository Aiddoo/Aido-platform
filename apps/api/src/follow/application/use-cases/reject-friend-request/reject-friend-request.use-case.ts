import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
} from "../../ports/follow.repository.port";

export interface RejectFriendRequestInput {
	userId: string;
	requesterUserId: string;
}

/**
 * 친구 요청 거절 use-case. 받은 PENDING 요청을 삭제한다.
 */
@Injectable()
export class RejectFriendRequestUseCase {
	readonly #logger = new Logger(RejectFriendRequestUseCase.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
	) {}

	async execute(input: RejectFriendRequestInput): Promise<void> {
		const { userId, requesterUserId } = input;

		const request = await this.followRepository.findByFollowerAndFollowing(
			requesterUserId,
			userId,
		);
		if (!request?.isPending()) {
			throw new ApplicationException(ErrorCode.FOLLOW_0903, {
				targetUserId: requesterUserId,
			});
		}

		await this.followRepository.delete(request.id);

		this.#logger.log(
			`Friend request rejected: ${requesterUserId} -> ${userId}`,
		);
	}
}
