import { Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import type { Follow } from "@/generated/prisma/client";

import {
	type FindFollowsParams,
	FollowRepository,
	type FollowWithUser,
} from "./follow.repository";

// =============================================================================
// 타입 정의
// =============================================================================

export interface SendFollowRequestResult {
	follow: Follow;
	autoAccepted: boolean;
}

export interface GetFollowsParams {
	userId: string;
	cursor?: string;
	size?: number;
}

// =============================================================================
// Service
// =============================================================================

@Injectable()
export class FollowService {
	private readonly logger = new Logger(FollowService.name);

	constructor(
		private readonly followRepository: FollowRepository,
		private readonly paginationService: PaginationService,
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
				// 상대방이 보낸 요청이 PENDING 상태면 자동 수락
				await this.followRepository.updateByFollowerAndFollowing(
					targetUserId,
					userId,
					{ status: "ACCEPTED" },
				);

				// 내 쪽도 ACCEPTED로 생성
				const follow = await this.followRepository.create({
					follower: { connect: { id: userId } },
					following: { connect: { id: targetUserId } },
					status: "ACCEPTED",
				});

				this.logger.log(
					`Friend request auto-accepted: ${userId} <-> ${targetUserId}`,
				);

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
	 */
	async acceptRequest(userId: string, requesterUserId: string): Promise<void> {
		// 1. 받은 요청 존재 체크
		const request = await this.followRepository.findByFollowerAndFollowing(
			requesterUserId,
			userId,
		);

		if (!request || request.status !== "PENDING") {
			throw BusinessExceptions.followRequestNotFound(requesterUserId);
		}

		// 2. 요청을 ACCEPTED로 업데이트
		await this.followRepository.update(request.id, { status: "ACCEPTED" });

		// 3. 역방향 Follow 생성 (나 -> 상대방)
		const existingReverse =
			await this.followRepository.findByFollowerAndFollowing(
				userId,
				requesterUserId,
			);

		if (existingReverse) {
			// 이미 존재하면 ACCEPTED로 업데이트
			await this.followRepository.update(existingReverse.id, {
				status: "ACCEPTED",
			});
		} else {
			// 없으면 새로 생성
			await this.followRepository.create({
				follower: { connect: { id: userId } },
				following: { connect: { id: requesterUserId } },
				status: "ACCEPTED",
			});
		}

		this.logger.log(
			`Friend request accepted: ${requesterUserId} <-> ${userId}`,
		);
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

		// 내 쪽 삭제
		await this.followRepository.delete(myFollow.id);

		// 상대방 쪽도 삭제 (친구 관계였다면)
		const theirFollow = await this.followRepository.findByFollowerAndFollowing(
			targetUserId,
			userId,
		);

		if (theirFollow) {
			await this.followRepository.delete(theirFollow.id);
		}

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
