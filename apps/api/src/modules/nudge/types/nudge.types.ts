/**
 * Nudge 모듈 타입 정의
 *
 * 독촉(콕 찌르기) 기능 관련 인터페이스와 타입들
 */

import type { Nudge, Todo, User } from "@/generated/prisma/client";

// 공통 타입 재내보내기
export type { TransactionClient } from "@/common/database";

// =============================================================================
// 사용자 정보 타입
// =============================================================================

/**
 * Nudge에 포함되는 사용자 정보
 */
export interface NudgeUserInfo {
	id: string;
	userTag: string;
	profile: {
		name: string | null;
		profileImage: string | null;
	} | null;
}

/**
 * Nudge에 포함되는 Todo 정보
 */
export interface NudgeTodoInfo {
	id: number;
	title: string;
	completed: boolean;
}

/**
 * 사용자 및 Todo 정보가 포함된 Nudge 엔티티
 */
export interface NudgeWithRelations extends Nudge {
	sender: Pick<User, "id" | "userTag"> & {
		profile: { name: string | null; profileImage: string | null } | null;
	};
	receiver: Pick<User, "id" | "userTag"> & {
		profile: { name: string | null; profileImage: string | null } | null;
	};
	todo: Pick<Todo, "id" | "title" | "completed">;
}

// =============================================================================
// 서비스 레이어 타입
// =============================================================================

/**
 * Nudge 발송 파라미터
 */
export interface SendNudgeParams {
	senderId: string;
	receiverId: string;
	todoId: number;
	message?: string;
}

/**
 * Nudge 발송 결과
 */
export interface SendNudgeResult {
	nudge: NudgeWithRelations;
	notificationSent: boolean;
}

/**
 * Nudge 목록 조회 파라미터
 */
export interface GetNudgesParams {
	userId: string;
	cursor?: number;
	size?: number;
}

/**
 * Nudge 제한 정보
 */
export interface NudgeLimitInfo {
	dailyLimit: number | null; // null = 무제한
	used: number;
	remaining: number | null; // null = 무제한
}

/**
 * Nudge 쿨다운 정보 (내부용)
 */
export interface NudgeCooldownInfo {
	isActive: boolean;
	cooldownEndsAt: Date | null;
	remainingSeconds: number;
}

// =============================================================================
// 레포지토리 레이어 타입
// =============================================================================

/**
 * Nudge 목록 조회 파라미터 (레포지토리용)
 */
export interface FindNudgesParams {
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
	todoId: number;
}
