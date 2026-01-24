/**
 * Follow 모듈 타입 정의
 *
 * 팔로우/친구 관계 관련 인터페이스와 타입들
 */

import type { Follow, FollowStatus, User } from "@/generated/prisma/client";

// 공통 타입 재내보내기
export type { TransactionClient } from "@/common/database";

// =============================================================================
// 사용자 정보 타입
// =============================================================================

/**
 * Follow에 포함되는 사용자 정보
 */
export interface FollowUserInfo {
	id: string;
	userTag: string;
	profile: {
		name: string | null;
		profileImage: string | null;
	} | null;
}

/**
 * 사용자 정보가 포함된 Follow 엔티티
 */
export interface FollowWithUser extends Follow {
	follower: Pick<User, "id" | "userTag"> & {
		profile: { name: string | null; profileImage: string | null } | null;
	};
	following: Pick<User, "id" | "userTag"> & {
		profile: { name: string | null; profileImage: string | null } | null;
	};
}

// =============================================================================
// 서비스 레이어 타입
// =============================================================================

/**
 * 친구 요청 전송 결과
 */
export interface SendFollowRequestResult {
	follow: Follow;
	autoAccepted: boolean;
}

/**
 * 친구/팔로우 목록 조회 파라미터
 */
export interface GetFollowsParams {
	userId: string;
	cursor?: string;
	size?: number;
	search?: string;
}

// =============================================================================
// 레포지토리 레이어 타입
// =============================================================================

/**
 * 팔로우 목록 조회 파라미터 (레포지토리용)
 */
export interface FindFollowsParams {
	userId: string;
	status?: FollowStatus;
	cursor?: string;
	size: number;
	search?: string;
}
