/**
 * Todo 모듈 타입 정의
 */

import type { DayOfWeek } from "@aido/validators";
import type { Prisma } from "@/generated/prisma/client";

// 공통 타입 재내보내기

/**
 * Todo 조회 시 포함할 카테고리·하위 항목 select 설정
 *
 * 모든 Todo 조회/생성/수정 메서드의 공통 include. 필드 변경 시 이 상수만 수정하면 반영됩니다.
 * 이 상수에서 `TodoWithCategory` 타입을 파생하므로 타입 단언(as) 없이 정합됩니다.
 */
export const TODO_CATEGORY_INCLUDE = {
	category: {
		select: { id: true, name: true, color: true, sortOrder: true },
	},
	items: {
		select: {
			id: true,
			title: true,
			completed: true,
			sortOrder: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: { sortOrder: "asc" as const },
	},
} as const;

// ===== 공통 타입 =====

/**
 * 하위 항목 데이터
 */
export interface TodoItemData {
	id: number;
	title: string;
	completed: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

// ===== Service Layer Types =====

/**
 * Todo 생성 시 필요한 데이터
 */
export interface CreateTodoData {
	userId: string;
	title: string;
	categoryId: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	items?: { title: string }[];
}

/**
 * 반복 Todo 생성 시 필요한 데이터
 */
export interface CreateRecurringTodoData {
	userId: string;
	title: string;
	categoryId: number;
	startDate: string;
	endDate: string;
	daysOfWeek: DayOfWeek[];
	scheduledTime?: string | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
}

/**
 * Todo 수정 시 사용되는 데이터
 */
export interface UpdateTodoData {
	title?: string;
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
 * 카테고리·하위 항목이 포함된 Todo 행 (Repository 반환 타입)
 *
 * `TODO_CATEGORY_INCLUDE`에서 파생 — Prisma 결과와 정확히 일치하므로 `as` 단언이 불필요합니다.
 */
export type TodoWithCategory = Prisma.TodoGetPayload<{
	include: typeof TODO_CATEGORY_INCLUDE;
}>;

/**
 * Todo 순서 변경 파라미터
 */
export interface ReorderTodoParams {
	userId: string;
	todoId: number;
	targetTodoId?: number;
	position: "before" | "after";
}
