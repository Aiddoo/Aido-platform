import { Inject, Injectable, Logger } from "@nestjs/common";

import { EntitlementService, Resource } from "@/shared/application/entitlement/entitlement.service";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";

import { FOLLOW_CACHE, type FollowCachePort } from "../ports/follow-cache.port";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
	type FollowWithUser,
} from "../ports/follow.repository.port";

/** 친구/요청 목록 조회 파라미터 (정규화 전 — size 선택) */
export interface GetFollowsParams {
	userId: string;
	cursor?: string;
	size?: number;
	search?: string;
}

/**
 * FollowReader — 친구 관계 읽기 전용 서비스.
 *
 * 조회 경로를 담당하며, 읽기-빈도 높고 변경-빈도 낮은 사실(맞팔 여부·맞팔 ID 목록·친구 수)만
 * FollowCachePort로 read-through 캐싱한다. 목록/요청 페이지네이션은 캐싱하지 않는다.
 */
@Injectable()
export class FollowReader {
	readonly #logger = new Logger(FollowReader.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		@Inject(FOLLOW_CACHE)
		private readonly cache: FollowCachePort,
		private readonly paginationService: PaginationService,
		private readonly entitlementService: EntitlementService,
	) {}

	/** 친구 리소스 제한 정보 조회 */
	async getResourceLimitInfo(
		userId: string,
	): Promise<{ friendCount: number; maxCount: number | null }> {
		const [entitlement, friendCount] = await Promise.all([
			this.entitlementService.getResourceLimit(userId, Resource.FRIEND),
			this.countFriends(userId),
		]);
		return { friendCount, maxCount: entitlement.maxCount };
	}

	/** 내 친구 목록 (맞팔 관계) */
	async getFriends(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		const { cursor, size } = this.paginationService.normalizeCursorPagination<string>({
			cursor: params.cursor,
			size: params.size,
		});

		const follows = await this.followRepository.findMutualFriends({
			userId: params.userId,
			cursor,
			size,
			search: params.search,
		});

		this.#logger.debug(`Friends listed: ${follows.length} items for user: ${params.userId}`);

		return this.paginationService.createCursorPaginatedResponse<FollowWithUser, string>({
			items: follows,
			size,
		});
	}

	/** 받은 친구 요청 목록 */
	async getReceivedRequests(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		const { cursor, size } = this.paginationService.normalizeCursorPagination<string>({
			cursor: params.cursor,
			size: params.size,
		});

		const follows = await this.followRepository.findReceivedRequests({
			userId: params.userId,
			cursor,
			size,
		});

		this.#logger.debug(
			`Received requests listed: ${follows.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<FollowWithUser, string>({
			items: follows,
			size,
		});
	}

	/** 보낸 친구 요청 목록 */
	async getSentRequests(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		const { cursor, size } = this.paginationService.normalizeCursorPagination<string>({
			cursor: params.cursor,
			size: params.size,
		});

		const follows = await this.followRepository.findSentRequests({
			userId: params.userId,
			cursor,
			size,
		});

		this.#logger.debug(`Sent requests listed: ${follows.length} items for user: ${params.userId}`);

		return this.paginationService.createCursorPaginatedResponse<FollowWithUser, string>({
			items: follows,
			size,
		});
	}

	/** 맞팔 여부 확인 (캐시 적용, 키는 정규화된 (smaller, larger)) */
	async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		const [smallerId, largerId] =
			userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];

		const cached = await this.cache.getMutualFriend(smallerId, largerId);
		if (cached !== undefined) {
			return cached;
		}

		const isMutual = await this.followRepository.isMutualFriend(userId, targetUserId);
		await this.cache.setMutualFriend(smallerId, largerId, isMutual);
		return isMutual;
	}

	/** 친구 수 조회 (캐시 적용) */
	async countFriends(userId: string): Promise<number> {
		return this.cache.wrapFriendCount(userId, () =>
			this.followRepository.countMutualFriends(userId),
		);
	}

	/** 받은 친구 요청 수 */
	async countReceivedRequests(userId: string): Promise<number> {
		return this.followRepository.countReceivedRequests(userId);
	}

	/** 보낸 친구 요청 수 */
	async countSentRequests(userId: string): Promise<number> {
		return this.followRepository.countSentRequests(userId);
	}

	/** 사용자 표시 이름 조회 (알림용) */
	async getUserDisplayName(userId: string): Promise<string> {
		return this.followRepository.getUserDisplayName(userId);
	}

	/** 맞팔 친구 ID 목록 조회 (알림 발송용, 캐시 적용) */
	async getMutualFriendIds(userId: string): Promise<string[]> {
		return this.cache.wrapMutualFriendIds(userId, () =>
			this.followRepository.getMutualFriendIds(userId),
		);
	}
}
