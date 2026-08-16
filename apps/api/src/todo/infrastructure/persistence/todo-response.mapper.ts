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
} from "@/shared/domain/date/utils/format";

import type { TodoWithCategory } from "./todo-row.types";

/**
 * Todo 매퍼 클래스
 *
 * Prisma 엔티티를 API 응답 형식으로 변환하는 Static 메서드를 제공합니다.
 */
export abstract class TodoMapper {
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
	static toResponse(entity: TodoWithCategory): Todo {
		const items = (entity.items ?? []).map((item) => ({
			id: item.id,
			title: item.title,
			completed: item.completed,
			sortOrder: item.sortOrder,
			createdAt: toISOString(item.createdAt),
			updatedAt: toISOString(item.updatedAt),
		}));

		return {
			id: entity.id,
			userId: entity.userId,
			title: entity.title,
			content: null, // deprecated: 하위 호환용
			sortOrder: entity.sortOrder,
			completed: entity.completed,
			completedAt: toISOStringOrNull(entity.completedAt),
			startDate: toDateString(entity.startDate),
			endDate: toDateStringOrNull(entity.endDate),
			scheduledTime: toISOStringOrNull(entity.scheduledTime),
			isAllDay: entity.isAllDay,
			visibility: entity.visibility,
			recurrenceGroupId: entity.recurrenceGroupId,
			category: {
				id: entity.category.id,
				name: entity.category.name,
				color: entity.category.color,
				sortOrder: entity.category.sortOrder,
			},
			items,
			itemStats: {
				total: items.length,
				completed: items.filter((i) => i.completed).length,
			},
			commentCount: entity.commentCount,
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
	static toManyResponse(entities: TodoWithCategory[]): Todo[] {
		return entities.map((entity) => TodoMapper.toResponse(entity));
	}
}
