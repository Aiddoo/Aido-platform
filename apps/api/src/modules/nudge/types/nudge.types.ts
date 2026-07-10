/**
 * Nudge 모듈 타입 정의
 *
 * 콕 찌르기 기능 관련 인터페이스와 타입들
 */

import type {
	Nudge,
	ReminderNudge,
	Todo,
	User,
} from "@/generated/prisma/client";

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

/**
 * 사용자 정보가 포함된 ReminderNudge 엔티티
 */
export interface ReminderNudgeWithRelations extends ReminderNudge {
	sender: Pick<User, "id" | "userTag"> & {
		profile: { name: string | null; profileImage: string | null } | null;
	};
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
 * 리마인드 Nudge 발송 파라미터
 */
export interface SendRemindNudgeParams {
	senderId: string;
	receiverId: string;
	message?: string;
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

/**
 * Nudge 검증용 Todo 정보
 */
export type TodoForNudgeValidation = Pick<
	Todo,
	"id" | "userId" | "title" | "startDate" | "endDate" | "visibility"
>;

/**
 * Nudge 생성 데이터
 */
export interface CreateNudgeData {
	senderId: string;
	receiverId: string;
	todoId: number;
	message?: string;
}
