import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { UserTag } from "../../../domain/value-objects/user-tag.vo";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
} from "../../ports/follow.repository.port";
import {
	type SendFriendRequestResult,
	SendFriendRequestUseCase,
} from "../send-friend-request/send-friend-request.use-case";

export interface SendFriendRequestByTagInput {
	userId: string;
	targetUserTag: string;
}

/**
 * userTag로 친구 요청 보내기 use-case.
 * 태그를 사용자 ID로 해석한 뒤 SendFriendRequestUseCase에 위임한다.
 */
@Injectable()
export class SendFriendRequestByTagUseCase {
	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		private readonly sendFriendRequest: SendFriendRequestUseCase,
	) {}

	async execute(
		input: SendFriendRequestByTagInput,
	): Promise<SendFriendRequestResult> {
		const targetTag = UserTag.of(input.targetUserTag);
		const targetUser = await this.followRepository.findUserByTag(
			targetTag.value,
		);
		if (!targetUser) {
			throw new ApplicationException(ErrorCode.FOLLOW_0905, {
				userTag: input.targetUserTag,
			});
		}

		return this.sendFriendRequest.execute({
			userId: input.userId,
			targetUserId: targetUser.id,
		});
	}
}
