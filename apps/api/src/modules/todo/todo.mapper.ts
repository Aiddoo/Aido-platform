/**
 * Todo 매퍼 함수
 *
 * Prisma Todo 엔티티를 응답 DTO로 변환하는 순수 함수들을 제공합니다.
 * 모든 함수는 부수 효과가 없으며, 동일한 입력에 대해 항상 동일한 출력을 반환합니다.
 *
 * @module todo.mapper
 */

import type { Todo } from "@/generated/prisma/client";

/**
 * Todo 응답 형식
 *
 * API 응답에서 사용되는 Todo 데이터 형식입니다.
 * 날짜 필드들은 ISO 8601 문자열로 변환됩니다.
 */
export interface TodoResponse {
	id: number;
	userId: string;
	title: string;
	content: string | null;
	color: string | null;
	completed: boolean;
	completedAt: string | null;
	startDate: string;
	endDate: string | null;
	scheduledTime: string | null;
	isAllDay: boolean;
	visibility: "PUBLIC" | "PRIVATE";
	createdAt: string;
	updatedAt: string;
}

/**
 * ISO 날짜 문자열에서 날짜 부분만 추출합니다. (YYYY-MM-DD)
 *
 * @param date - 변환할 Date 객체
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 *
 * @example
 * ```typescript
 * const date = new Date('2024-01-15T09:30:00Z');
 * const dateString = formatDateToString(date);
 * // 결과: '2024-01-15'
 * ```
 */
export function formatDateToString(date: Date): string {
	return date.toISOString().split("T")[0] ?? date.toISOString().slice(0, 10);
}

/**
 * Prisma Todo 엔티티를 API 응답 형식으로 변환합니다.
 *
 * @param todo - Prisma에서 조회한 Todo 엔티티
 * @returns API 응답용 TodoResponse 객체
 *
 * @example
 * ```typescript
 * const todo = await prisma.todo.findUnique({ where: { id: 1 } });
 * const response = mapTodoToResponse(todo);
 * // 결과: { id: 1, title: '할 일', startDate: '2024-01-15', ... }
 * ```
 */
export function mapTodoToResponse(todo: Todo): TodoResponse {
	return {
		id: todo.id,
		userId: todo.userId,
		title: todo.title,
		content: todo.content,
		color: todo.color,
		completed: todo.completed,
		completedAt: todo.completedAt?.toISOString() ?? null,
		startDate: formatDateToString(todo.startDate),
		endDate: todo.endDate ? formatDateToString(todo.endDate) : null,
		scheduledTime: todo.scheduledTime?.toISOString() ?? null,
		isAllDay: todo.isAllDay,
		visibility: todo.visibility as "PUBLIC" | "PRIVATE",
		createdAt: todo.createdAt.toISOString(),
		updatedAt: todo.updatedAt.toISOString(),
	};
}

/**
 * 여러 Todo 엔티티를 API 응답 형식으로 일괄 변환합니다.
 *
 * @param todos - Prisma에서 조회한 Todo 엔티티 배열
 * @returns API 응답용 TodoResponse 객체 배열
 *
 * @example
 * ```typescript
 * const todos = await prisma.todo.findMany({ where: { userId } });
 * const responses = mapTodosToResponse(todos);
 * // 결과: [{ id: 1, ... }, { id: 2, ... }]
 * ```
 */
export function mapTodosToResponse(todos: Todo[]): TodoResponse[] {
	return todos.map(mapTodoToResponse);
}
