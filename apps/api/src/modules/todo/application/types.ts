/**
 * Todo 애플리케이션 계층 파라미터 타입
 *
 * 커맨드·쿼리·포트가 공유하는 프레임워크 비의존 입력 타입입니다.
 * (Prisma 파생 행 타입은 infrastructure/persistence/todo-row.types.ts 참조)
 */

import type { DayOfWeek } from "@aido/validators";

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

/**
 * 읽기 리포지토리에서 Todo 목록 조회 시 사용되는 파라미터
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
 * 읽기 리포지토리에서 친구 Todo 목록 조회 시 사용되는 파라미터
 */
export interface FindFriendTodosParams {
	friendUserId: string;
	cursor?: number;
	size: number;
	startDate?: Date;
	endDate?: Date;
}
