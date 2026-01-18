/**
 * Cheer 모듈 타입 정의
 *
 * 응원 기능 관련 인터페이스와 타입들
 */

import type { Cheer, User } from "@/generated/prisma/client";

// 공통 타입 재내보내기
export type { TransactionClient } from "@/common/database";

// =============================================================================
// 사용자 정보 타입
// =============================================================================

/**
 * Cheer에 포함되는 사용자 정보
 */
export interface CheerUserInfo {
	id: string;
	userTag: string;
	profile: {
		name: string | null;
		profileImage: string | null;
	} | null;
}

/**
 * 사용자 정보가 포함된 Cheer 엔티티
 */
export interface CheerWithRelations extends Cheer {
	sender: Pick<User, "id" | "userTag"> & {
		profile: { name: string | null; profileImage: string | null } | null;
	};
	receiver: Pick<User, "id" | "userTag"> & {
		profile: { name: string | null; profileImage: string | null } | null;
	};
}

// =============================================================================
// 서비스 레이어 타입
// =============================================================================

/**
 * Cheer 발송 파라미터
 */
export interface SendCheerParams {
	senderId: string;
	receiverId: string;
	message?: string;
}

/**
 * Cheer 발송 결과
 */
export interface SendCheerResult {
	cheer: CheerWithRelations;
	notificationSent: boolean;
}

/**
 * Cheer 목록 조회 파라미터
 */
export interface GetCheersParams {
	userId: string;
	cursor?: number;
	size?: number;
}

/**
 * Cheer 제한 정보
 */
export interface CheerLimitInfo {
	dailyLimit: number | null; // null = 무제한
	used: number;
	remaining: number | null; // null = 무제한
}

/**
 * Cheer 쿨다운 정보
 */
export interface CheerCooldownInfo {
	isActive: boolean;
	canCheerAt: Date | null;
	remainingSeconds: number;
}

// =============================================================================
// 레포지토리 레이어 타입
// =============================================================================

/**
 * Cheer 목록 조회 파라미터 (레포지토리용)
 */
export interface FindCheersParams {
	userId: string;
	cursor?: number;
	size: number;
}

/**
 * 일일 제한 체크 파라미터
 */
export interface CheckDailyLimitParams {
	senderId: string;
	date: Date;
}

/**
 * 쿨다운 체크 파라미터
 */
export interface CheckCooldownParams {
	senderId: string;
	receiverId: string;
}
