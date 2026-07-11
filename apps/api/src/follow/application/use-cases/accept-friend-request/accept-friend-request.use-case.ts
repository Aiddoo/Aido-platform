import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
	type FollowWithUser,
} from "../../ports/follow.repository.port";
import { FriendshipEffects } from "../../services/friendship-effects.service";

export interface AcceptFriendRequestInput {
	userId: string;
	requesterUserId: string;
}

/**
 * 친구 요청 수락 use-case.
 *
 * 받은 PENDING 요청을 ACCEPTED로 바꾸고, 역방향 관계도 생성/갱신해 양방향 친구를 성립시킨다.
 * 반환값은 "나 -> 상대방" 방향의 FollowWithUser(컨트롤러가 friend로 매핑).
 */
@Injectable()
export class AcceptFriendRequestUseCase {
	readonly #logger = new Logger(AcceptFriendRequestUseCase.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly effects: FriendshipEffects,
	) {}

	async execute(input: AcceptFriendRequestInput): Promise<FollowWithUser> {
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

		const myFollow = await this.uow.run(async () => {
			const [maxSortUser, maxSortRequester] = await Promise.all([
				this.followRepository.getMaxSortOrderForFriends(userId),
				this.followRepository.getMaxSortOrderForFriends(requesterUserId),
			]);

			await this.followRepository.update(request.id, {
				status: "ACCEPTED",
				sortOrder: maxSortRequester + 1,
			});

			const existingReverse =
				await this.followRepository.findByFollowerAndFollowing(
					userId,
					requesterUserId,
				);

			const createdFollow = existingReverse
				? await this.followRepository.update(existingReverse.id, {
						status: "ACCEPTED",
						sortOrder: maxSortUser + 1,
					})
				: await this.followRepository.create({
						followerId: userId,
						followingId: requesterUserId,
						status: "ACCEPTED",
						sortOrder: maxSortUser + 1,
					});

			const followWithUser = await this.followRepository.findByIdWithUser(
				createdFollow.id,
			);
			if (!followWithUser) {
				throw new ApplicationException(ErrorCode.SYS_0001, {
					detail: "Failed to retrieve created follow with user info",
					context: { followId: createdFollow.id, userId, requesterUserId },
				});
			}
			return followWithUser;
		});

		this.#logger.log(
			`Friend request accepted: ${requesterUserId} <-> ${userId}`,
		);

		await this.effects.invalidateFriendshipCaches(userId, requesterUserId);

		const userName =
			myFollow.follower.profile?.name ?? myFollow.follower.userTag;
		const requesterName =
			myFollow.following.profile?.name ?? myFollow.following.userTag;

		this.effects.notifyMutual({
			userId,
			friendId: requesterUserId,
			friendName: requesterName,
		});
		this.effects.notifyMutual({
			userId: requesterUserId,
			friendId: userId,
			friendName: userName,
		});

		await Promise.all([
			this.effects.checkFirstFriendMilestone(userId),
			this.effects.checkFirstFriendMilestone(requesterUserId),
		]);

		return myFollow;
	}
}
