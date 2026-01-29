/**
 * Todo 모듈 타입 정의
 */

// 공통 타입 재내보내기
export type { TransactionClient } from "@/common/database";

// ===== Service Layer Types =====

/**
 * Todo 생성 시 필요한 데이터
 */
export interface CreateTodoData {
	userId: string;
	title: string;
	content?: string | null;
	categoryId: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
}

/**
 * Todo 수정 시 사용되는 데이터
 */
export interface UpdateTodoData {
	title?: string;
	content?: string | null;
	categoryId?: number;
	startDate?: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	completed?: boolean;
}

/**
 * Todo 목록 조회 파라미터
 */
export interface GetTodosParams {
	userId: string;
	cursor?: number;
	size?: number;
	completed?: boolean;
	categoryId?: number;
	startDate?: Date;
	endDate?: Date;
}

/**
 * 친구 Todo 목록 조회 파라미터
 */
export interface GetFriendTodosParams {
	userId: string;
	friendUserId: string;
	cursor?: number;
	size?: number;
	startDate?: Date;
	endDate?: Date;
}

// ===== Repository Layer Types =====

/**
 * Repository에서 Todo 목록 조회 시 사용되는 파라미터
 */
export interface FindTodosParams {
	userId: string;
	cursor?: number;
	size: number;
	completed?: boolean;
	categoryId?: number;
	startDate?: Date;
	endDate?: Date;
}

/**
 * Repository에서 친구 Todo 목록 조회 시 사용되는 파라미터
 */
export interface FindFriendTodosParams {
	friendUserId: string;
	cursor?: number;
	size: number;
	startDate?: Date;
	endDate?: Date;
}

/**
 * 카테고리 정보가 포함된 Todo (Repository에서 사용)
 */
export interface TodoWithCategory {
	id: number;
	userId: string;
	title: string;
	content: string | null;
	categoryId: number;
	sortOrder: number;
	completed: boolean;
	completedAt: Date | null;
	startDate: Date;
	endDate: Date | null;
	scheduledTime: Date | null;
	isAllDay: boolean;
	visibility: "PUBLIC" | "PRIVATE";
	createdAt: Date;
	updatedAt: Date;
	category: {
		id: number;
		name: string;
		color: string;
	};
}

/**
 * Todo 순서 변경 파라미터
 */
export interface ReorderTodoParams {
	userId: string;
	todoId: number;
	targetTodoId?: number;
	position: "before" | "after";
}
