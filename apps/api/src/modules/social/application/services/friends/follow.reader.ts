import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { Resource } from "#api/modules/access/application/services/entitlement/entitlement.service";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type FollowCachePort } from "../../ports/friends/follow-cache.port.js";
import {
  type FollowRepositoryPort,
  type FollowWithUser,
} from "../../ports/friends/follow.repository.port.js";

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
interface FollowReaderDependencies {
  readonly followRepository: FollowRepositoryPort;
  readonly cache: FollowCachePort;
  readonly paginationService: PaginationService;
  readonly entitlementService: EntitlementService;
  readonly logger: ApplicationLogger;
}

export class FollowReader {
  readonly #dependencies: FollowReaderDependencies;

  constructor(dependencies: FollowReaderDependencies) {
    this.#dependencies = dependencies;
  }

  /** 친구 리소스 제한 정보 조회 */
  async getResourceLimitInfo(
    userId: string,
  ): Promise<{ friendCount: number; maxCount: number | null }> {
    const [entitlement, friendCount] = await Promise.all([
      this.#dependencies.entitlementService.getResourceLimit(userId, Resource.FRIEND),
      this.countFriends(userId),
    ]);
    return { friendCount, maxCount: entitlement.maxCount };
  }

  /** 내 친구 목록 (맞팔 관계) */
  async getFriends(
    params: GetFollowsParams,
  ): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<string>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const follows = await this.#dependencies.followRepository.findMutualFriends({
      userId: params.userId,
      cursor,
      size,
      search: params.search,
    });

    this.#dependencies.logger.debug(
      `Friends listed: ${follows.length} items for user: ${params.userId}`,
    );

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      FollowWithUser,
      string
    >({
      items: follows,
      size,
    });
  }

  /** 받은 친구 요청 목록 */
  async getReceivedRequests(
    params: GetFollowsParams,
  ): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<string>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const follows = await this.#dependencies.followRepository.findReceivedRequests({
      userId: params.userId,
      cursor,
      size,
    });

    this.#dependencies.logger.debug(
      `Received requests listed: ${follows.length} items for user: ${params.userId}`,
    );

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      FollowWithUser,
      string
    >({
      items: follows,
      size,
    });
  }

  /** 보낸 친구 요청 목록 */
  async getSentRequests(
    params: GetFollowsParams,
  ): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<string>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const follows = await this.#dependencies.followRepository.findSentRequests({
      userId: params.userId,
      cursor,
      size,
    });

    this.#dependencies.logger.debug(
      `Sent requests listed: ${follows.length} items for user: ${params.userId}`,
    );

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      FollowWithUser,
      string
    >({
      items: follows,
      size,
    });
  }

  /** 맞팔 여부 확인 (캐시 적용, 키는 정규화된 (smaller, larger)) */
  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    const [smallerId, largerId] =
      userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];

    const cached = await this.#dependencies.cache.getMutualFriend(smallerId, largerId);
    if (cached !== undefined) {
      return cached;
    }

    const isMutual = await this.#dependencies.followRepository.isMutualFriend(userId, targetUserId);
    await this.#dependencies.cache.setMutualFriend(smallerId, largerId, isMutual);
    return isMutual;
  }

  /** 친구 수 조회 (캐시 적용) */
  async countFriends(userId: string): Promise<number> {
    return this.#dependencies.cache.wrapFriendCount(userId, () =>
      this.#dependencies.followRepository.countMutualFriends(userId),
    );
  }

  /** 받은 친구 요청 수 */
  async countReceivedRequests(userId: string): Promise<number> {
    return this.#dependencies.followRepository.countReceivedRequests(userId);
  }

  /** 보낸 친구 요청 수 */
  async countSentRequests(userId: string): Promise<number> {
    return this.#dependencies.followRepository.countSentRequests(userId);
  }

  /** 사용자 표시 이름 조회 (알림용) */
  async getUserDisplayName(userId: string): Promise<string> {
    return this.#dependencies.followRepository.getUserDisplayName(userId);
  }

  /** 맞팔 친구 ID 목록 조회 (알림 발송용, 캐시 적용) */
  async getMutualFriendIds(userId: string): Promise<string[]> {
    return this.#dependencies.cache.wrapMutualFriendIds(userId, () =>
      this.#dependencies.followRepository.getMutualFriendIds(userId),
    );
  }

  /** 권한을 판단하는 쓰기 경로는 캐시 대신 현재 친구 관계를 조회한다. */
  getCurrentMutualFriendIds(userId: string): Promise<string[]> {
    return this.#dependencies.followRepository.getMutualFriendIds(userId);
  }
}
