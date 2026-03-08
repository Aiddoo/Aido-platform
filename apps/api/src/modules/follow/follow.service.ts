import { Injectable, Logger } from "@nestjs/common";
import { CacheService } from "@/common/cache/cache.service";
import {
	EntitlementService,
	Resource,
} from "@/common/entitlement/entitlement.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { type Follow, Prisma } from "@/generated/prisma/client";
import { NotificationQueueService } from "@/modules/notification/queue";

import { FollowRepository } from "./follow.repository";
import type {
	FindFollowsParams,
	FollowWithUser,
	GetFollowsParams,
	SendFollowRequestResult,
} from "./types/follow.types";

@Injectable()
export class FollowService {
	readonly #logger = new Logger(FollowService.name);

	constructor(
		private readonly followRepository: FollowRepository,
		private readonly paginationService: PaginationService,
		private readonly entitlementService: EntitlementService,
		private readonly database: DatabaseService,
		private readonly notificationQueueService: NotificationQueueService,
		private readonly cacheService: CacheService,
	) {}

	/**
	 * 친구 리소스 제한 정보 조회
	 */
	async getResourceLimitInfo(
		userId: string,
	): Promise<{ friendCount: number; maxCount: number | null }> {
		const [entitlement, friendCount] = await Promise.all([
			this.entitlementService.getResourceLimit(userId, Resource.FRIEND),
			this.countFriends(userId),
		]);
		return { friendCount, maxCount: entitlement.maxCount };
	}

	/**
	 * userTag로 친구 요청 보내기
	 *
	 * @param userId 요청자 ID
	 * @param targetUserTag 대상 사용자 태그 (8자리 영숫자)
	 */
	async sendRequestByTag(
		userId: string,
		targetUserTag: string,
	): Promise<SendFollowRequestResult> {
		const targetUser = await this.followRepository.findUserByTag(targetUserTag);
		if (!targetUser) {
			throw BusinessExceptions.followTargetNotFoundByTag(targetUserTag);
		}

		return this.sendRequest(userId, targetUser.id);
	}

	/**
	 * 친구 요청 보내기 (userId 기반)
	 *
	 * 1. 자기 자신 체크
	 * 2. 대상 사용자 존재 체크
	 * 3. 기존 관계 체크:
	 *    - 이미 ACCEPTED → 에러
	 *    - 이미 PENDING (내가 보냄) → 에러
	 *    - 상대방이 PENDING으로 보냄 → 자동 수락
	 * 4. 새 Follow 레코드 생성 (status: PENDING)
	 */
	async sendRequest(
		userId: string,
		targetUserId: string,
	): Promise<SendFollowRequestResult> {
		// 1. 자기 자신 체크
		if (userId === targetUserId) {
			throw BusinessExceptions.cannotFollowSelf();
		}

		// 2. 리소스 제한 체크
		const [entitlement, friendCount] = await Promise.all([
			this.entitlementService.getResourceLimit(userId, Resource.FRIEND),
			this.countFriends(userId),
		]);
		this.entitlementService.enforceResourceLimit(
			friendCount,
			entitlement.maxCount,
			BusinessExceptions.friendLimitExceeded,
		);

		// 3. 대상 사용자 존재 체크
		const targetExists = await this.followRepository.userExists(targetUserId);

		if (!targetExists) {
			throw BusinessExceptions.followTargetNotFound(targetUserId);
		}

		// 4. 기존 관계 체크
		const existingFollow =
			await this.followRepository.findByFollowerAndFollowing(
				userId,
				targetUserId,
			);

		if (existingFollow?.status === "ACCEPTED") {
			throw BusinessExceptions.alreadyFriends(targetUserId);
		}

		if (existingFollow) {
			throw BusinessExceptions.followRequestAlreadySent(targetUserId);
		}

		// 5. 상대방이 이미 친구 요청을 보냈는지 확인
		const reverseFollow =
			await this.followRepository.findByFollowerAndFollowing(
				targetUserId,
				userId,
			);

		if (reverseFollow?.status === "ACCEPTED") {
			throw BusinessExceptions.alreadyFriends(targetUserId);
		}

		if (reverseFollow?.status === "PENDING") {
			// 상대방이 보낸 요청이 PENDING 상태면 자동 수락 (트랜잭션으로 처리)
			let follow: Follow;
			try {
				follow = await this.database.$transaction(async (tx) => {
					await this.followRepository.updateByFollowerAndFollowing(
						targetUserId,
						userId,
						{ status: "ACCEPTED" },
						tx,
					);

					return this.followRepository.create(
						{
							follower: { connect: { id: userId } },
							following: { connect: { id: targetUserId } },
							status: "ACCEPTED",
						},
						tx,
					);
				});
			} catch (error) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002"
				) {
					throw BusinessExceptions.followRequestAlreadySent(targetUserId);
				}
				throw error;
			}

			this.#logger.log(
				`Friend request auto-accepted: ${userId} <-> ${targetUserId}`,
			);

			const [userName, targetUserName] = await Promise.all([
				this.followRepository.getUserName(userId),
				this.followRepository.getUserName(targetUserId),
			]);

			this.notificationQueueService.enqueueFollowMutual({
				userId,
				friendId: targetUserId,
				friendName: targetUserName ?? "알 수 없음",
			});

			this.notificationQueueService.enqueueFollowMutual({
				userId: targetUserId,
				friendId: userId,
				friendName: userName ?? "알 수 없음",
			});

			await Promise.all([
				this.cacheService.invalidateMutualFriend(userId, targetUserId),
				this.cacheService.invalidateMutualFriendIds(userId),
				this.cacheService.invalidateMutualFriendIds(targetUserId),
				this.cacheService.invalidateFriendCount(userId),
				this.cacheService.invalidateFriendCount(targetUserId),
			]);

			return { follow, autoAccepted: true };
		}

		let follow: Follow;
		try {
			follow = await this.followRepository.create({
				follower: { connect: { id: userId } },
				following: { connect: { id: targetUserId } },
				status: "PENDING",
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw BusinessExceptions.followRequestAlreadySent(targetUserId);
			}
			throw error;
		}

		this.#logger.log(`Friend request sent: ${userId} -> ${targetUserId}`);

		const followerName = await this.followRepository.getUserName(userId);
		this.notificationQueueService.enqueueFollowNew({
			followerId: userId,
			followingId: targetUserId,
			followerName: followerName ?? "알 수 없음",
		});

		return { follow, autoAccepted: false };
	}

	/**
	 * 친구 요청 수락
	 *
	 * 1. 받은 요청 존재 체크 (followingId = 나, status = PENDING)
	 * 2. status를 ACCEPTED로 업데이트
	 * 3. 역방향 Follow도 ACCEPTED로 생성 (양방향 친구)
	 *
	 * @returns 생성된 역방향 Follow (나 -> 상대방)
	 */
	async acceptRequest(
		userId: string,
		requesterUserId: string,
	): Promise<FollowWithUser> {
		// 1. 받은 요청 존재 체크
		const request = await this.followRepository.findByFollowerAndFollowing(
			requesterUserId,
			userId,
		);

		if (!request || request.status !== "PENDING") {
			throw BusinessExceptions.followRequestNotFound(requesterUserId);
		}

		const myFollow = await this.database.$transaction(async (tx) => {
			await this.followRepository.update(
				request.id,
				{ status: "ACCEPTED" },
				tx,
			);

			const existingReverse =
				await this.followRepository.findByFollowerAndFollowing(
					userId,
					requesterUserId,
					tx,
				);

			const createdFollow = existingReverse
				? await this.followRepository.update(
						existingReverse.id,
						{ status: "ACCEPTED" },
						tx,
					)
				: await this.followRepository.create(
						{
							follower: { connect: { id: userId } },
							following: { connect: { id: requesterUserId } },
							status: "ACCEPTED",
						},
						tx,
					);

			const followWithUser = await this.followRepository.findByIdWithUser(
				createdFollow.id,
				tx,
			);

			if (!followWithUser) {
				throw BusinessExceptions.internalServerError({
					detail: "Failed to retrieve created follow with user info",
					context: { followId: createdFollow.id, userId, requesterUserId },
				});
			}

			return followWithUser;
		});

		this.#logger.log(
			`Friend request accepted: ${requesterUserId} <-> ${userId}`,
		);

		await Promise.all([
			this.cacheService.invalidateMutualFriend(userId, requesterUserId),
			this.cacheService.invalidateMutualFriendIds(userId),
			this.cacheService.invalidateMutualFriendIds(requesterUserId),
			this.cacheService.invalidateFriendCount(userId),
			this.cacheService.invalidateFriendCount(requesterUserId),
		]);

		const [userName, requesterName] = await Promise.all([
			this.followRepository.getUserName(userId),
			this.followRepository.getUserName(requesterUserId),
		]);

		this.notificationQueueService.enqueueFollowMutual({
			userId,
			friendId: requesterUserId,
			friendName: requesterName ?? "알 수 없음",
		});

		this.notificationQueueService.enqueueFollowMutual({
			userId: requesterUserId,
			friendId: userId,
			friendName: userName ?? "알 수 없음",
		});

		return myFollow;
	}

	/**
	 * 친구 요청 거절 (삭제)
	 */
	async rejectRequest(userId: string, requesterUserId: string): Promise<void> {
		const request = await this.followRepository.findByFollowerAndFollowing(
			requesterUserId,
			userId,
		);

		if (!request || request.status !== "PENDING") {
			throw BusinessExceptions.followRequestNotFound(requesterUserId);
		}

		await this.followRepository.delete(request.id);

		this.#logger.log(
			`Friend request rejected: ${requesterUserId} -> ${userId}`,
		);
	}

	/**
	 * 친구 관계 삭제 또는 보낸 요청 철회
	 */
	async remove(userId: string, targetUserId: string): Promise<void> {
		const myFollow = await this.followRepository.findByFollowerAndFollowing(
			userId,
			targetUserId,
		);

		if (!myFollow) {
			throw BusinessExceptions.notFriends(targetUserId);
		}

		await this.database.$transaction(async (tx) => {
			await this.followRepository.delete(myFollow.id, tx);

			const theirFollow =
				await this.followRepository.findByFollowerAndFollowing(
					targetUserId,
					userId,
					tx,
				);

			if (theirFollow) {
				await this.followRepository.delete(theirFollow.id, tx);
			}
		});

		await Promise.all([
			this.cacheService.invalidateMutualFriend(userId, targetUserId),
			this.cacheService.invalidateMutualFriendIds(userId),
			this.cacheService.invalidateMutualFriendIds(targetUserId),
			this.cacheService.invalidateFriendCount(userId),
			this.cacheService.invalidateFriendCount(targetUserId),
		]);

		this.#logger.log(`Follow removed: ${userId} X ${targetUserId}`);
	}

	/**
	 * 내 친구 목록 (맞팔 관계)
	 */
	async getFriends(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<string>({
				cursor: params.cursor,
				size: params.size,
			});

		const repoParams: FindFollowsParams = {
			userId: params.userId,
			cursor,
			size,
			search: params.search,
		};

		const follows = await this.followRepository.findMutualFriends(repoParams);

		this.#logger.debug(
			`Friends listed: ${follows.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			FollowWithUser,
			string
		>({
			items: follows,
			size,
		});
	}

	/**
	 * 받은 친구 요청 목록
	 */
	async getReceivedRequests(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<string>({
				cursor: params.cursor,
				size: params.size,
			});

		const repoParams: FindFollowsParams = {
			userId: params.userId,
			cursor,
			size,
		};

		const follows =
			await this.followRepository.findReceivedRequests(repoParams);

		this.#logger.debug(
			`Received requests listed: ${follows.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			FollowWithUser,
			string
		>({
			items: follows,
			size,
		});
	}

	/**
	 * 보낸 친구 요청 목록
	 */
	async getSentRequests(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<string>({
				cursor: params.cursor,
				size: params.size,
			});

		const repoParams: FindFollowsParams = {
			userId: params.userId,
			cursor,
			size,
		};

		const follows = await this.followRepository.findSentRequests(repoParams);

		this.#logger.debug(
			`Sent requests listed: ${follows.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			FollowWithUser,
			string
		>({
			items: follows,
			size,
		});
	}

	/**
	 * 맞팔 여부 확인
	 */
	async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		const [smallerId, largerId] =
			userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];
		const cached = await this.cacheService.getMutualFriend(smallerId, largerId);
		if (cached !== undefined) {
			return cached;
		}

		const isMutual = await this.followRepository.isMutualFriend(
			userId,
			targetUserId,
		);

		await this.cacheService.setMutualFriend(smallerId, largerId, isMutual);

		return isMutual;
	}

	/**
	 * 친구 수 조회
	 */
	async countFriends(userId: string): Promise<number> {
		return this.cacheService.wrapFriendCount(userId, () =>
			this.followRepository.countMutualFriends(userId),
		);
	}

	/**
	 * 받은 친구 요청 수 조회
	 */
	async countReceivedRequests(userId: string): Promise<number> {
		return this.followRepository.countReceivedRequests(userId);
	}

	/**
	 * 보낸 친구 요청 수 조회
	 */
	async countSentRequests(userId: string): Promise<number> {
		return this.followRepository.countSentRequests(userId);
	}

	/**
	 * 사용자 이름 조회 (알림용)
	 */
	async getUserName(userId: string): Promise<string | null> {
		return this.followRepository.getUserName(userId);
	}

	/**
	 * 맞팔 친구 ID 목록 조회 (알림 발송용, 캐시 적용)
	 */
	async getMutualFriendIds(userId: string): Promise<string[]> {
		return this.cacheService.wrapMutualFriendIds(userId, () =>
			this.followRepository.getMutualFriendIds(userId),
		);
	}
}
