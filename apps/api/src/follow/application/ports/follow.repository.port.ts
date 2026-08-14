import type { Friendship } from "../../domain/entities/friendship.aggregate";
import type { FriendshipStatusValue } from "../../domain/value-objects/friendship-status.vo";

/**
 * FollowRepositoryPort — 친구/팔로우 영속성 포트.
 *
 * 애플리케이션 계층이 의존하는 유일한 저장소 추상화.
 * - 단건 쓰기/조회는 **Friendship 애그리게잇**을 반환한다(어댑터가 Prisma 행 → 엔티티 매핑).
 * - 목록/사용자 포함 조회는 **FollowWithUser 읽기 프로젝션**(비정규화 뷰)을 반환한다.
 *
 * 반환 타입은 Prisma가 아닌 애플리케이션/도메인 소유 타입이며, 트랜잭션은 CLS UoW로 전파된다.
 */

/** 팔로우 관계 읽기 프로젝션의 기본 필드 */
export interface FollowRecord {
	id: string;
	followerId: string;
	followingId: string;
	status: FriendshipStatusValue;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

/** 알림/목록 응답에 필요한 사용자 요약 */
export interface FollowUserBrief {
	id: string;
	userTag: string;
	profile: { name: string | null; profileImage: string | null } | null;
}

/** 양측 사용자 정보가 포함된 팔로우 읽기 프로젝션 */
export interface FollowWithUser extends FollowRecord {
	follower: FollowUserBrief;
	following: FollowUserBrief;
}

/** 목록 조회 파라미터 */
export interface FindFollowsParams {
	userId: string;
	cursor?: string;
	size: number;
	search?: string;
}

/**
 * 사용자 검색 결과 프로젝션.
 * 뷰어 기준 관계 flag를 포함하며, `rank`는 관련도 버킷(내부 페이지네이션용, 매퍼에서 드롭).
 */
export interface UserSearchResult {
	id: string;
	userTag: string;
	profile: { name: string | null; profileImage: string | null } | null;
	isFollowing: boolean;
	isFollower: boolean;
	isFriend: boolean;
	requestPending: boolean;
	rank: number;
}

/** 사용자 검색 파라미터 (정규화·디코딩 완료 상태) */
export interface SearchUsersParams {
	viewerId: string;
	nfcQuery: string;
	upperTag: string;
	cursor?: { rank: number; id: string };
	size: number;
}

/** 팔로우 생성 입력 */
export interface CreateFollowInput {
	followerId: string;
	followingId: string;
	status: FriendshipStatusValue;
	sortOrder?: number;
}

/** 팔로우 수정 입력 */
export interface UpdateFollowInput {
	status?: FriendshipStatusValue;
	sortOrder?: number;
}

export const FOLLOW_REPOSITORY = Symbol("FOLLOW_REPOSITORY");

export interface FollowRepositoryPort {
	/**
	 * 팔로우 관계 생성.
	 * 유니크 제약(followerId_followingId) 위반 시 FOLLOW_0901로 번역해 던진다.
	 */
	create(input: CreateFollowInput): Promise<Friendship>;
	findByFollowerAndFollowing(followerId: string, followingId: string): Promise<Friendship | null>;
	findByIdWithUser(id: string): Promise<FollowWithUser | null>;
	update(id: string, input: UpdateFollowInput): Promise<Friendship>;
	updateByFollowerAndFollowing(
		followerId: string,
		followingId: string,
		input: UpdateFollowInput,
	): Promise<Friendship>;
	delete(id: string): Promise<void>;

	findMutualFriends(params: FindFollowsParams): Promise<FollowWithUser[]>;
	findReceivedRequests(params: FindFollowsParams): Promise<FollowWithUser[]>;
	findSentRequests(params: FindFollowsParams): Promise<FollowWithUser[]>;

	/** 이름/태그로 전체 활성 사용자 검색 (관련도 랭킹, size+1 반환). */
	searchUsers(params: SearchUsersParams): Promise<UserSearchResult[]>;
	/** 검색 조건에 매칭되는 전체 사용자 수 (커서·size 무관). */
	countSearchUsers(params: Omit<SearchUsersParams, "cursor" | "size">): Promise<number>;

	findAcceptedByIdAndFollowerId(id: string, followerId: string): Promise<Friendship | null>;
	getMaxSortOrderForFriends(followerId: string): Promise<number>;
	shiftFriendSortOrders(
		followerId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
	): Promise<number>;
	updateFollowSortOrder(id: string, sortOrder: number): Promise<FollowWithUser>;

	isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
	countMutualFriends(userId: string): Promise<number>;
	countReceivedRequests(userId: string): Promise<number>;
	countSentRequests(userId: string): Promise<number>;

	userExists(userId: string): Promise<boolean>;
	getUserDisplayName(userId: string): Promise<string>;
	findUserByTag(userTag: string): Promise<{ id: string } | null>;
	getMutualFriendIds(userId: string): Promise<string[]>;
}
