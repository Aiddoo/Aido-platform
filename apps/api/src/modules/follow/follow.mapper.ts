/**
 * Follow 모듈 매퍼
 *
 * FollowWithUser 엔티티를 응답 DTO 형식으로 변환하는 Static 메서드를 제공합니다.
 * 친구 관계, 친구 요청 등의 데이터를 API 응답에 적합한 형식으로 변환합니다.
 *
 * @module follow.mapper
 */

import type {
	Follow,
	FriendRequestUser,
	FriendsListResponse,
	FriendUser,
	ReceivedRequestsResponse,
	SentRequestsResponse,
} from "@aido/validators";
import { toISOString } from "@/common/date";
import type { Follow as FollowEntity } from "@/generated/prisma/client";
import type { FollowWithUser } from "./types/follow.types";

/**
 * Follow 매퍼 클래스
 *
 * Prisma 엔티티를 API 응답 형식으로 변환하는 Static 메서드를 제공합니다.
 */
export class FollowMapper {
	/**
	 * Follow 엔티티를 기본 응답 형식으로 변환합니다.
	 *
	 * @param entity - Prisma에서 조회한 Follow 엔티티
	 * @returns API 응답용 Follow 객체
	 */
	static toResponse(entity: FollowEntity): Follow {
		return {
			id: entity.id,
			followerId: entity.followerId,
			followingId: entity.followingId,
			status: entity.status,
			createdAt: toISOString(entity.createdAt),
			updatedAt: toISOString(entity.updatedAt),
		};
	}

	/**
	 * FollowWithUser를 친구 정보로 변환합니다.
	 *
	 * findMutualFriends 쿼리에서 followerId = 현재 사용자이므로
	 * following이 항상 친구(상대방)입니다.
	 *
	 * @param follow - 사용자 정보가 포함된 Follow 엔티티
	 * @returns 친구 정보 응답 객체
	 */
	static toFriendUser(follow: FollowWithUser): FriendUser {
		const friend = follow.following;
		return {
			followId: follow.id,
			id: friend.id,
			userTag: friend.userTag,
			name: friend.profile?.name ?? null,
			profileImage: friend.profile?.profileImage ?? null,
			friendsSince: toISOString(follow.updatedAt),
		};
	}

	/**
	 * 받은 친구 요청을 요청 정보로 변환합니다.
	 *
	 * 받은 요청에서는 follower가 요청을 보낸 사람입니다.
	 *
	 * @param follow - 사용자 정보가 포함된 Follow 엔티티 (PENDING 상태)
	 * @returns 친구 요청 정보 응답 객체
	 */
	static toReceivedRequest(follow: FollowWithUser): FriendRequestUser {
		const requester = follow.follower;
		return {
			id: requester.id,
			userTag: requester.userTag,
			name: requester.profile?.name ?? null,
			profileImage: requester.profile?.profileImage ?? null,
			requestedAt: toISOString(follow.createdAt),
		};
	}

	/**
	 * 보낸 친구 요청을 요청 정보로 변환합니다.
	 *
	 * 보낸 요청에서는 following이 요청을 받은 사람입니다.
	 *
	 * @param follow - 사용자 정보가 포함된 Follow 엔티티 (PENDING 상태)
	 * @returns 친구 요청 정보 응답 객체
	 */
	static toSentRequest(follow: FollowWithUser): FriendRequestUser {
		const recipient = follow.following;
		return {
			id: recipient.id,
			userTag: recipient.userTag,
			name: recipient.profile?.name ?? null,
			profileImage: recipient.profile?.profileImage ?? null,
			requestedAt: toISOString(follow.createdAt),
		};
	}

	/**
	 * FollowWithUser 배열을 친구 목록으로 일괄 변환합니다.
	 *
	 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열
	 * @returns 친구 정보 응답 객체 배열
	 */
	static toFriendUsers(follows: FollowWithUser[]): FriendUser[] {
		return follows.map((f) => FollowMapper.toFriendUser(f));
	}

	/**
	 * FollowWithUser 배열을 받은 요청 목록으로 일괄 변환합니다.
	 *
	 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열 (PENDING 상태)
	 * @returns 친구 요청 정보 응답 객체 배열
	 */
	static toReceivedRequests(follows: FollowWithUser[]): FriendRequestUser[] {
		return follows.map((f) => FollowMapper.toReceivedRequest(f));
	}

	/**
	 * FollowWithUser 배열을 보낸 요청 목록으로 일괄 변환합니다.
	 *
	 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열 (PENDING 상태)
	 * @returns 친구 요청 정보 응답 객체 배열
	 */
	static toSentRequests(follows: FollowWithUser[]): FriendRequestUser[] {
		return follows.map((f) => FollowMapper.toSentRequest(f));
	}

	/**
	 * 친구 목록 응답을 생성합니다.
	 *
	 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열
	 * @param totalCount - 전체 친구 수
	 * @param hasMore - 다음 페이지 존재 여부
	 * @returns 친구 목록 응답 객체
	 */
	static toFriendsListResponse(
		follows: FollowWithUser[],
		totalCount: number,
		hasMore: boolean,
	): FriendsListResponse {
		return {
			friends: FollowMapper.toFriendUsers(follows),
			totalCount,
			hasMore,
		};
	}

	/**
	 * 받은 친구 요청 목록 응답을 생성합니다.
	 *
	 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열 (PENDING 상태)
	 * @param totalCount - 전체 요청 수
	 * @param hasMore - 다음 페이지 존재 여부
	 * @returns 받은 친구 요청 목록 응답 객체
	 */
	static toReceivedRequestsResponse(
		follows: FollowWithUser[],
		totalCount: number,
		hasMore: boolean,
	): ReceivedRequestsResponse {
		return {
			requests: FollowMapper.toReceivedRequests(follows),
			totalCount,
			hasMore,
		};
	}

	/**
	 * 보낸 친구 요청 목록 응답을 생성합니다.
	 *
	 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열 (PENDING 상태)
	 * @param totalCount - 전체 요청 수
	 * @param hasMore - 다음 페이지 존재 여부
	 * @returns 보낸 친구 요청 목록 응답 객체
	 */
	static toSentRequestsResponse(
		follows: FollowWithUser[],
		totalCount: number,
		hasMore: boolean,
	): SentRequestsResponse {
		return {
			requests: FollowMapper.toSentRequests(follows),
			totalCount,
			hasMore,
		};
	}
}
