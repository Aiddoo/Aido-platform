import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { Follow } from "@/generated/prisma/client";
import {
	type FollowMutualEventPayload,
	type FollowNewEventPayload,
	NotificationEvents,
} from "@/modules/notification/events";

import { FollowRepository } from "./follow.repository";
import type {
	FindFollowsParams,
	FollowWithUser,
	GetFollowsParams,
	SendFollowRequestResult,
} from "./types/follow.types";

// =============================================================================
// Service
// =============================================================================

@Injectable()
export class FollowService {
	private readonly logger = new Logger(FollowService.name);

	constructor(
		private readonly followRepository: FollowRepository,
		private readonly paginationService: PaginationService,
		private readonly database: DatabaseService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	// =========================================================================
	// 친구 요청 보내기
	// =========================================================================

	/**
	 * 친구 요청 보내기
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

		// 2. 대상 사용자 존재 체크
		const targetExists = await this.followRepository.userExists(targetUserId);
		if (!targetExists) {
			throw BusinessExceptions.followTargetNotFound(targetUserId);
		}

		// 3. 기존 관계 체크
		const existingFollow =
			await this.followRepository.findByFollowerAndFollowing(
				userId,
				targetUserId,
			);

		if (existingFollow) {
			if (existingFollow.status === "ACCEPTED") {
				throw BusinessExceptions.alreadyFriends(targetUserId);
			}
			// PENDING 상태로 이미 보낸 경우
			throw BusinessExceptions.followRequestAlreadySent(targetUserId);
		}

		// 4. 상대방이 이미 친구 요청을 보냈는지 확인
		const reverseFollow =
			await this.followRepository.findByFollowerAndFollowing(
				targetUserId,
				userId,
			);

		if (reverseFollow) {
			if (reverseFollow.status === "PENDING") {
				// 상대방이 보낸 요청이 PENDING 상태면 자동 수락 (트랜잭션으로 처리)
				const follow = await this.database.$transaction(async (tx) => {
					await this.followRepository.updateByFollowerAndFollowing(
						targetUserId,
						userId,
						{ status: "ACCEPTED" },
						tx,
					);

					// 내 쪽도 ACCEPTED로 생성
					return this.followRepository.create(
						{
							follower: { connect: { id: userId } },
							following: { connect: { id: targetUserId } },
							status: "ACCEPTED",
						},
						tx,
					);
				});

				this.logger.log(
					`Friend request auto-accepted: ${userId} <-> ${targetUserId}`,
				);

				// 양방향 친구 성립 이벤트 발행 (양쪽 모두에게 알림)
				const [userName, targetUserName] = await Promise.all([
					this.followRepository.getUserName(userId),
					this.followRepository.getUserName(targetUserId),
				]);

				// userId에게 알림 (targetUserId와 친구가 됨)
				this.eventEmitter.emit(NotificationEvents.FOLLOW_MUTUAL, {
					userId,
					friendId: targetUserId,
					friendName: targetUserName ?? "알 수 없음",
				} satisfies FollowMutualEventPayload);

				// targetUserId에게 알림 (userId와 친구가 됨)
				this.eventEmitter.emit(NotificationEvents.FOLLOW_MUTUAL, {
					userId: targetUserId,
					friendId: userId,
					friendName: userName ?? "알 수 없음",
				} satisfies FollowMutualEventPayload);

				return { follow, autoAccepted: true };
			}
			// 이미 ACCEPTED 상태
			throw BusinessExceptions.alreadyFriends(targetUserId);
		}

		// 5. 새 친구 요청 생성
		const follow = await this.followRepository.create({
			follower: { connect: { id: userId } },
			following: { connect: { id: targetUserId } },
			status: "PENDING",
		});

		this.logger.log(`Friend request sent: ${userId} -> ${targetUserId}`);

		// 새 친구 요청 이벤트 발행
		const followerName = await this.followRepository.getUserName(userId);
		this.eventEmitter.emit(NotificationEvents.FOLLOW_NEW, {
			followerId: userId,
			followingId: targetUserId,
			followerName: followerName ?? "알 수 없음",
		} satisfies FollowNewEventPayload);

		return { follow, autoAccepted: false };
	}

	// =========================================================================
	// 친구 요청 수락
	// =========================================================================

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

		// 2, 3. 트랜잭션으로 양방향 관계 처리
		const myFollow = await this.database.$transaction(async (tx) => {
			// 상대방의 요청을 ACCEPTED로 업데이트
			await this.followRepository.update(
				request.id,
				{ status: "ACCEPTED" },
				tx,
			);

			// 역방향 Follow 확인 (나 -> 상대방)
			const existingReverse =
				await this.followRepository.findByFollowerAndFollowing(
					userId,
					requesterUserId,
					tx,
				);

			let createdFollow: Follow;
			if (existingReverse) {
				// 이미 존재하면 ACCEPTED로 업데이트
				createdFollow = await this.followRepository.update(
					existingReverse.id,
					{ status: "ACCEPTED" },
					tx,
				);
			} else {
				// 없으면 새로 생성
				createdFollow = await this.followRepository.create(
					{
						follower: { connect: { id: userId } },
						following: { connect: { id: requesterUserId } },
						status: "ACCEPTED",
					},
					tx,
				);
			}

			// 생성된 Follow에 사용자 정보를 포함하여 반환
			const followWithUser = await this.followRepository.findByIdWithUser(
				createdFollow.id,
				tx,
			);

			if (!followWithUser) {
				throw new Error("Failed to retrieve created follow with user info");
			}

			return followWithUser;
		});

		this.logger.log(
			`Friend request accepted: ${requesterUserId} <-> ${userId}`,
		);

		// 양방향 친구 성립 이벤트 발행 (양쪽 모두에게 알림)
		const [userName, requesterName] = await Promise.all([
			this.followRepository.getUserName(userId),
			this.followRepository.getUserName(requesterUserId),
		]);

		// userId(수락자)에게 알림 (requesterUserId와 친구가 됨)
		this.eventEmitter.emit(NotificationEvents.FOLLOW_MUTUAL, {
			userId,
			friendId: requesterUserId,
			friendName: requesterName ?? "알 수 없음",
		} satisfies FollowMutualEventPayload);

		// requesterUserId(요청자)에게 알림 (userId와 친구가 됨)
		this.eventEmitter.emit(NotificationEvents.FOLLOW_MUTUAL, {
			userId: requesterUserId,
			friendId: userId,
			friendName: userName ?? "알 수 없음",
		} satisfies FollowMutualEventPayload);

		return myFollow;
	}

	// =========================================================================
	// 친구 요청 거절
	// =========================================================================

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

		this.logger.log(`Friend request rejected: ${requesterUserId} -> ${userId}`);
	}

	// =========================================================================
	// 친구 삭제 / 요청 철회
	// =========================================================================

	/**
	 * 친구 관계 삭제 또는 보낸 요청 철회
	 */
	async remove(userId: string, targetUserId: string): Promise<void> {
		// 내가 보낸 관계 확인
		const myFollow = await this.followRepository.findByFollowerAndFollowing(
			userId,
			targetUserId,
		);

		if (!myFollow) {
			throw BusinessExceptions.notFriends(targetUserId);
		}

		// 트랜잭션으로 양방향 삭제 처리
		await this.database.$transaction(async (tx) => {
			// 내 쪽 삭제
			await this.followRepository.delete(myFollow.id, tx);

			// 상대방 쪽도 삭제 (친구 관계였다면)
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

		this.logger.log(`Follow removed: ${userId} X ${targetUserId}`);
	}

	// =========================================================================
	// 친구 목록 조회
	// =========================================================================

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
		};

		const follows = await this.followRepository.findMutualFriends(repoParams);

		this.logger.debug(
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

		this.logger.debug(
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

		this.logger.debug(
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

	// =========================================================================
	// 유틸리티
	// =========================================================================

	/**
	 * 맞팔 여부 확인
	 */
	async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		return this.followRepository.isMutualFriend(userId, targetUserId);
	}

	/**
	 * 친구 수 조회
	 */
	async countFriends(userId: string): Promise<number> {
		return this.followRepository.countMutualFriends(userId);
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
}
