/**
 * TodoCategory 매퍼
 *
 * Prisma TodoCategory 엔티티를 응답 DTO로 변환하는 Static 메서드를 제공합니다.
 * 모든 메서드는 부수 효과가 없으며, 동일한 입력에 대해 항상 동일한 출력을 반환합니다.
 *
 * @module todo-category.mapper
 */

import type {
	TodoCategory,
	TodoCategorySummary,
	TodoCategoryWithCount,
} from "@aido/validators";
import { toISOString } from "@/common/date";
import type { TodoCategory as TodoCategoryEntity } from "@/generated/prisma/client";

import type { TodoCategoryWithCount as TodoCategoryWithCountEntity } from "./types/todo-category.types";

/**
 * TodoCategory 매퍼 클래스
 *
 * Prisma 엔티티를 API 응답 형식으로 변환하는 Static 메서드를 제공합니다.
 */
export abstract class TodoCategoryMapper {
	/**
	 * Prisma TodoCategory 엔티티를 API 응답 형식으로 변환합니다.
	 *
	 * @param entity - Prisma에서 조회한 TodoCategory 엔티티
	 * @returns API 응답용 TodoCategory 객체
	 *
	 * @example
	 * ```typescript
	 * const category = await prisma.todoCategory.findUnique({ where: { id: 1 } });
	 * const response = TodoCategoryMapper.toResponse(category);
	 * // 결과: { id: 1, name: '중요한 일', color: '#FFB3B3', ... }
	 * ```
	 */
	static toResponse(entity: TodoCategoryEntity): TodoCategory {
		return {
			id: entity.id,
			userId: entity.userId,
			name: entity.name,
			color: entity.color,
			sortOrder: entity.sortOrder,
			createdAt: toISOString(entity.createdAt),
			updatedAt: toISOString(entity.updatedAt),
		};
	}

	/**
	 * Prisma TodoCategory 엔티티를 요약 응답 형식으로 변환합니다.
	 * Todo 응답에 포함될 카테고리 정보용입니다.
	 *
	 * @param entity - Prisma에서 조회한 TodoCategory 엔티티
	 * @returns API 응답용 TodoCategorySummary 객체
	 *
	 * @example
	 * ```typescript
	 * const category = await prisma.todoCategory.findUnique({ where: { id: 1 } });
	 * const summary = TodoCategoryMapper.toSummary(category);
	 * // 결과: { id: 1, name: '중요한 일', color: '#FFB3B3' }
	 * ```
	 */
	static toSummary(entity: TodoCategoryEntity): TodoCategorySummary {
		return {
			id: entity.id,
			name: entity.name,
			color: entity.color,
		};
	}

	/**
	 * Prisma TodoCategory 엔티티를 Todo 개수 포함 응답 형식으로 변환합니다.
	 *
	 * @param entity - Prisma에서 조회한 TodoCategory 엔티티 (with _count)
	 * @returns API 응답용 TodoCategoryWithCount 객체
	 *
	 * @example
	 * ```typescript
	 * const category = await prisma.todoCategory.findUnique({
	 *   where: { id: 1 },
	 *   include: { _count: { select: { todos: true } } }
	 * });
	 * const response = TodoCategoryMapper.toResponseWithCount(category);
	 * // 결과: { id: 1, name: '중요한 일', color: '#FFB3B3', todoCount: 5, ... }
	 * ```
	 */
	static toResponseWithCount(
		entity: TodoCategoryWithCountEntity,
	): TodoCategoryWithCount {
		return {
			id: entity.id,
			userId: entity.userId,
			name: entity.name,
			color: entity.color,
			sortOrder: entity.sortOrder,
			todoCount: entity._count.todos,
			createdAt: toISOString(entity.createdAt),
			updatedAt: toISOString(entity.updatedAt),
		};
	}

	/**
	 * 여러 TodoCategory 엔티티를 API 응답 형식으로 일괄 변환합니다.
	 *
	 * @param entities - Prisma에서 조회한 TodoCategory 엔티티 배열
	 * @returns API 응답용 TodoCategory 객체 배열
	 */
	static toManyResponse(entities: TodoCategoryEntity[]): TodoCategory[] {
		return entities.map((entity) => TodoCategoryMapper.toResponse(entity));
	}

	/**
	 * 여러 TodoCategory 엔티티를 Todo 개수 포함 응답 형식으로 일괄 변환합니다.
	 *
	 * @param entities - Prisma에서 조회한 TodoCategory 엔티티 배열 (with _count)
	 * @returns API 응답용 TodoCategoryWithCount 객체 배열
	 */
	static toManyResponseWithCount(
		entities: TodoCategoryWithCountEntity[],
	): TodoCategoryWithCount[] {
		return entities.map((entity) =>
			TodoCategoryMapper.toResponseWithCount(entity),
		);
	}
}
