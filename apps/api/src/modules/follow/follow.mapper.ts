/**
 * Follow 모듈 매퍼 함수
 *
 * FollowWithUser 엔티티를 응답 DTO 형식으로 변환하는 순수 함수들을 제공합니다.
 * 친구 관계, 친구 요청 등의 데이터를 API 응답에 적합한 형식으로 변환합니다.
 *
 * @module follow.mapper
 */

import type { Follow, FollowStatus } from "@/generated/prisma/client";
import type { FollowWithUser } from "./types/follow.types";

/**
 * 친구 정보 응답 형식
 *
 * 친구 목록 조회 시 반환되는 사용자 정보입니다.
 */
export interface FriendUserResponse {
	followId: string;
	id: string;
	userTag: string;
	name: string | null;
	profileImage: string | null;
	friendsSince: Date;
}

/**
 * 친구 요청 사용자 정보 응답 형식
 *
 * 보낸/받은 친구 요청 목록에서 사용되는 사용자 정보입니다.
 */
export interface FriendRequestUserResponse {
	id: string;
	userTag: string;
	name: string | null;
	profileImage: string | null;
	requestedAt: Date;
}

/**
 * Follow 엔티티 기본 응답 형식
 *
 * Follow 관계의 기본 정보를 담은 응답 형식입니다.
 */
export interface FollowResponse {
	id: string;
	followerId: string;
	followingId: string;
	status: FollowStatus;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Follow 엔티티를 기본 응답 형식으로 변환합니다.
 *
 * @param follow - Prisma에서 조회한 Follow 엔티티
 * @returns API 응답용 FollowResponse 객체
 *
 * @example
 * ```typescript
 * const follow = await prisma.follow.findUnique({ where: { id } });
 * const response = mapFollowToResponse(follow);
 * // 결과: { id: '...', followerId: '...', status: 'ACCEPTED', ... }
 * ```
 */
export function mapFollowToResponse(follow: Follow): FollowResponse {
	return {
		id: follow.id,
		followerId: follow.followerId,
		followingId: follow.followingId,
		status: follow.status,
		createdAt: follow.createdAt,
		updatedAt: follow.updatedAt,
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
 *
 * @example
 * ```typescript
 * const follows = await followRepository.findMutualFriends(userId);
 * const friend = mapFollowToFriendUser(follows[0]);
 * // 결과: { followId: '...', id: '친구ID', userTag: '@friend', ... }
 * ```
 */
export function mapFollowToFriendUser(
	follow: FollowWithUser,
): FriendUserResponse {
	const friend = follow.following;
	return {
		followId: follow.id,
		id: friend.id,
		userTag: friend.userTag,
		name: friend.profile?.name ?? null,
		profileImage: friend.profile?.profileImage ?? null,
		friendsSince: follow.updatedAt,
	};
}

/**
 * 받은 친구 요청을 요청 정보로 변환합니다.
 *
 * 받은 요청에서는 follower가 요청을 보낸 사람입니다.
 *
 * @param follow - 사용자 정보가 포함된 Follow 엔티티 (PENDING 상태)
 * @returns 친구 요청 정보 응답 객체
 *
 * @example
 * ```typescript
 * const requests = await followRepository.findPendingFollowers(userId);
 * const request = mapFollowToReceivedRequest(requests[0]);
 * // 결과: { id: '요청자ID', userTag: '@requester', requestedAt: Date, ... }
 * ```
 */
export function mapFollowToReceivedRequest(
	follow: FollowWithUser,
): FriendRequestUserResponse {
	const requester = follow.follower;
	return {
		id: requester.id,
		userTag: requester.userTag,
		name: requester.profile?.name ?? null,
		profileImage: requester.profile?.profileImage ?? null,
		requestedAt: follow.createdAt,
	};
}

/**
 * 보낸 친구 요청을 요청 정보로 변환합니다.
 *
 * 보낸 요청에서는 following이 요청을 받은 사람입니다.
 *
 * @param follow - 사용자 정보가 포함된 Follow 엔티티 (PENDING 상태)
 * @returns 친구 요청 정보 응답 객체
 *
 * @example
 * ```typescript
 * const requests = await followRepository.findPendingFollowing(userId);
 * const request = mapFollowToSentRequest(requests[0]);
 * // 결과: { id: '수신자ID', userTag: '@recipient', requestedAt: Date, ... }
 * ```
 */
export function mapFollowToSentRequest(
	follow: FollowWithUser,
): FriendRequestUserResponse {
	const recipient = follow.following;
	return {
		id: recipient.id,
		userTag: recipient.userTag,
		name: recipient.profile?.name ?? null,
		profileImage: recipient.profile?.profileImage ?? null,
		requestedAt: follow.createdAt,
	};
}

/**
 * FollowWithUser 배열을 친구 목록으로 일괄 변환합니다.
 *
 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열
 * @returns 친구 정보 응답 객체 배열
 *
 * @example
 * ```typescript
 * const follows = await followRepository.findMutualFriends(userId);
 * const friends = mapFollowsToFriendUsers(follows);
 * // 결과: [{ followId: '...', id: '...', userTag: '@friend1' }, ...]
 * ```
 */
export function mapFollowsToFriendUsers(
	follows: FollowWithUser[],
): FriendUserResponse[] {
	return follows.map(mapFollowToFriendUser);
}

/**
 * FollowWithUser 배열을 받은 요청 목록으로 일괄 변환합니다.
 *
 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열 (PENDING 상태)
 * @returns 친구 요청 정보 응답 객체 배열
 *
 * @example
 * ```typescript
 * const requests = await followRepository.findPendingFollowers(userId);
 * const receivedRequests = mapFollowsToReceivedRequests(requests);
 * // 결과: [{ id: '요청자1', userTag: '@user1' }, { id: '요청자2', ... }]
 * ```
 */
export function mapFollowsToReceivedRequests(
	follows: FollowWithUser[],
): FriendRequestUserResponse[] {
	return follows.map(mapFollowToReceivedRequest);
}

/**
 * FollowWithUser 배열을 보낸 요청 목록으로 일괄 변환합니다.
 *
 * @param follows - 사용자 정보가 포함된 Follow 엔티티 배열 (PENDING 상태)
 * @returns 친구 요청 정보 응답 객체 배열
 *
 * @example
 * ```typescript
 * const requests = await followRepository.findPendingFollowing(userId);
 * const sentRequests = mapFollowsToSentRequests(requests);
 * // 결과: [{ id: '수신자1', userTag: '@user1' }, { id: '수신자2', ... }]
 * ```
 */
export function mapFollowsToSentRequests(
	follows: FollowWithUser[],
): FriendRequestUserResponse[] {
	return follows.map(mapFollowToSentRequest);
}
