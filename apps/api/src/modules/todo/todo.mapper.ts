/**
 * Todo 매퍼
 *
 * Prisma Todo 엔티티를 응답 DTO로 변환하는 Static 메서드를 제공합니다.
 * 모든 메서드는 부수 효과가 없으며, 동일한 입력에 대해 항상 동일한 출력을 반환합니다.
 *
 * @module todo.mapper
 */

import type { Todo } from "@aido/validators";
import {
	toDateString,
	toDateStringOrNull,
	toISOString,
	toISOStringOrNull,
} from "@/common/date";
import type { Todo as TodoEntity } from "@/generated/prisma/client";

/**
 * Todo 매퍼 클래스
 *
 * Prisma 엔티티를 API 응답 형식으로 변환하는 Static 메서드를 제공합니다.
 */
export abstract class TodoMapper {
	/**
	 * ISO 날짜 문자열에서 날짜 부분만 추출합니다. (YYYY-MM-DD)
	 *
	 * @param date - 변환할 Date 객체
	 * @returns YYYY-MM-DD 형식의 날짜 문자열
	 *
	 * @example
	 * ```typescript
	 * const date = new Date('2024-01-15T09:30:00Z');
	 * const dateString = TodoMapper.formatDate(date);
	 * // 결과: '2024-01-15'
	 * ```
	 */
	static formatDate(date: Date): string {
		return toDateString(date);
	}

	/**
	 * Prisma Todo 엔티티를 API 응답 형식으로 변환합니다.
	 *
	 * @param entity - Prisma에서 조회한 Todo 엔티티
	 * @returns API 응답용 Todo 객체
	 *
	 * @example
	 * ```typescript
	 * const todo = await prisma.todo.findUnique({ where: { id: 1 } });
	 * const response = TodoMapper.toResponse(todo);
	 * // 결과: { id: 1, title: '할 일', startDate: '2024-01-15', ... }
	 * ```
	 */
	static toResponse(entity: TodoEntity): Todo {
		return {
			id: entity.id,
			userId: entity.userId,
			title: entity.title,
			content: entity.content,
			color: entity.color,
			completed: entity.completed,
			completedAt: toISOStringOrNull(entity.completedAt),
			startDate: toDateString(entity.startDate),
			endDate: toDateStringOrNull(entity.endDate),
			scheduledTime: toISOStringOrNull(entity.scheduledTime),
			isAllDay: entity.isAllDay,
			visibility: entity.visibility as "PUBLIC" | "PRIVATE",
			createdAt: toISOString(entity.createdAt),
			updatedAt: toISOString(entity.updatedAt),
		};
	}

	/**
	 * 여러 Todo 엔티티를 API 응답 형식으로 일괄 변환합니다.
	 *
	 * @param entities - Prisma에서 조회한 Todo 엔티티 배열
	 * @returns API 응답용 Todo 객체 배열
	 *
	 * @example
	 * ```typescript
	 * const todos = await prisma.todo.findMany({ where: { userId } });
	 * const responses = TodoMapper.toManyResponse(todos);
	 * // 결과: [{ id: 1, ... }, { id: 2, ... }]
	 * ```
	 */
	static toManyResponse(entities: TodoEntity[]): Todo[] {
		return entities.map((entity) => TodoMapper.toResponse(entity));
	}
}
