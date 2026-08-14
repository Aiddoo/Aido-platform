import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { EntitlementService, Resource } from "@/shared/application/entitlement/entitlement.service";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { Friendship } from "../../../domain/entities/friendship.aggregate";
import { FOLLOW_NOTIFIER, type FollowNotifierPort } from "../../ports/follow-notifier.port";
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from "../../ports/follow.repository.port";
import { FollowReader } from "../../services/follow.reader";
import { FriendshipEffects } from "../../services/friendship-effects.service";

export interface SendFriendRequestInput {
	userId: string;
	targetUserId: string;
}

export interface SendFriendRequestResult {
	follow: Friendship;
	autoAccepted: boolean;
}

/**
 * 친구 요청 보내기 use-case.
 *
 * 자기 자신 체크 → 리소스 한도 → 대상 존재 → 기존 관계 검증 순으로 진행하며,
 * 상대가 이미 나에게 PENDING 요청을 보낸 경우 트랜잭션으로 자동 수락한다.
 * 유니크 제약 위반(P2002)은 저장소 어댑터가 FOLLOW_0901로 번역한다.
 */
@Injectable()
export class SendFriendRequestUseCase {
	readonly #logger = new Logger(SendFriendRequestUseCase.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		@Inject(FOLLOW_NOTIFIER)
		private readonly notifier: FollowNotifierPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly entitlementService: EntitlementService,
		private readonly reader: FollowReader,
		private readonly effects: FriendshipEffects,
	) {}

	async execute(input: SendFriendRequestInput): Promise<SendFriendRequestResult> {
		const { userId, targetUserId } = input;

		// 1. 자기 자신 체크
		if (userId === targetUserId) {
			throw new ApplicationException(ErrorCode.FOLLOW_0904);
		}

		// 2. 리소스 한도 체크
		const [entitlement, friendCount] = await Promise.all([
			this.entitlementService.getResourceLimit(userId, Resource.FRIEND),
			this.reader.countFriends(userId),
		]);
		if (entitlement.maxCount !== null && friendCount >= entitlement.maxCount) {
			throw new ApplicationException(ErrorCode.FOLLOW_0909, {
				current: friendCount,
				limit: entitlement.maxCount,
			});
		}

		// 3. 대상 사용자 존재 체크
		const targetExists = await this.followRepository.userExists(targetUserId);
		if (!targetExists) {
			throw new ApplicationException(ErrorCode.FOLLOW_0905, { targetUserId });
		}

		// 4. 기존 관계 체크
		const existingFollow = await this.followRepository.findByFollowerAndFollowing(
			userId,
			targetUserId,
		);
		if (existingFollow?.isAccepted()) {
			throw new ApplicationException(ErrorCode.FOLLOW_0902, { targetUserId });
		}
		if (existingFollow) {
			throw new ApplicationException(ErrorCode.FOLLOW_0901, { targetUserId });
		}

		// 5. 상대방이 이미 나에게 요청을 보냈는지 확인
		const reverseFollow = await this.followRepository.findByFollowerAndFollowing(
			targetUserId,
			userId,
		);
		if (reverseFollow?.isAccepted()) {
			throw new ApplicationException(ErrorCode.FOLLOW_0902, { targetUserId });
		}

		if (reverseFollow?.isPending()) {
			return this.#autoAccept(userId, targetUserId);
		}

		// 6. 새 PENDING 요청 생성
		const follow = await this.followRepository.create({
			followerId: userId,
			followingId: targetUserId,
			status: "PENDING",
		});

		this.#logger.log(`Friend request sent: ${userId} -> ${targetUserId}`);

		const followerName = await this.followRepository.getUserDisplayName(userId);
		this.notifier.notifyFollowNew({
			followerId: userId,
			followingId: targetUserId,
			followerName,
		});

		return { follow, autoAccepted: false };
	}

	async #autoAccept(userId: string, targetUserId: string): Promise<SendFriendRequestResult> {
		const follow = await this.uow.run(async () => {
			const [maxSortUser, maxSortTarget] = await Promise.all([
				this.followRepository.getMaxSortOrderForFriends(userId),
				this.followRepository.getMaxSortOrderForFriends(targetUserId),
			]);

			await this.followRepository.updateByFollowerAndFollowing(targetUserId, userId, {
				status: "ACCEPTED",
				sortOrder: maxSortTarget + 1,
			});

			return this.followRepository.create({
				followerId: userId,
				followingId: targetUserId,
				status: "ACCEPTED",
				sortOrder: maxSortUser + 1,
			});
		});

		this.#logger.log(`Friend request auto-accepted: ${userId} <-> ${targetUserId}`);

		const [userName, targetUserName] = await Promise.all([
			this.followRepository.getUserDisplayName(userId),
			this.followRepository.getUserDisplayName(targetUserId),
		]);

		this.effects.notifyMutual({
			userId,
			friendId: targetUserId,
			friendName: targetUserName,
		});
		this.effects.notifyMutual({
			userId: targetUserId,
			friendId: userId,
			friendName: userName,
		});

		await Promise.all([
			this.effects.checkFirstFriendMilestone(userId),
			this.effects.checkFirstFriendMilestone(targetUserId),
		]);

		await this.effects.invalidateFriendshipCaches(userId, targetUserId);

		return { follow, autoAccepted: true };
	}
}
