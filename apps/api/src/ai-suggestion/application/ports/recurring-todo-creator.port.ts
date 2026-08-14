import type { DayOfWeek } from "@aido/validators";

export const RECURRING_TODO_CREATOR = Symbol("RECURRING_TODO_CREATOR");

/** 반복 할 일 생성 입력 — todo 모듈의 반복 생성 계약과 동일한 형태 */
export interface CreateRecurringTodoInput {
	userId: string;
	title: string;
	categoryId: number;
	startDate: string;
	endDate: string;
	daysOfWeek: DayOfWeek[];
	scheduledTime: string | null;
}

/**
 * 반복 할 일 생성 포트.
 *
 * 제안 수락 시 todo 모듈에 반복 할 일 생성을 위임한다. 어댑터가 todo의 공개 계약
 * (TodoCreator)으로 컨텍스트 경계를 흡수한다.
 */
export interface RecurringTodoCreatorPort {
	createRecurring(input: CreateRecurringTodoInput, timezone: string): Promise<{ count: number }>;
}
