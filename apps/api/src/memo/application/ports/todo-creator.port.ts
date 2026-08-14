import type { DayOfWeek, Todo as TodoResponse } from "@aido/validators";

import type { CreateRecurringTodosResult } from "@/todo";

export const TODO_CREATOR = Symbol("TODO_CREATOR");

/**
 * 단건 할 일 생성 입력 (todo 모듈 CreateTodoData와 구조 동일한 메모 측 정의).
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
 * 반복 할 일 생성 입력 (todo 모듈 CreateRecurringTodoData와 구조 동일한 메모 측 정의).
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
 * 메모가 todo 생성에 의존하는 유일한 통로 (ACL 포트).
 */
export interface TodoCreatorPort {
	createTodo(data: CreateTodoData): Promise<TodoResponse>;
	createRecurringTodos(
		data: CreateRecurringTodoData,
		timezone: string,
	): Promise<CreateRecurringTodosResult>;
}
