/**
 * TodoCategory 프레젠테이션 매퍼 — 애플리케이션 타입 → API 응답(@aido/validators). 계약 불변.
 */
import type {
	TodoCategory as TodoCategoryDto,
	TodoCategoryWithCount as TodoCategoryWithCountDto,
} from "@aido/validators";

import { toISOString } from "@/shared/domain/date/utils/format";
import type { TodoCategoryWithCountView } from "../application/ports/todo-category.repository.port";
import type { TodoCategory } from "../domain/entities/todo-category.entity";

export abstract class TodoCategoryMapper {
	static toResponse(category: TodoCategory): TodoCategoryDto {
		return {
			id: category.id,
			userId: category.userId,
			name: category.name,
			color: category.color,
			sortOrder: category.sortOrder,
			createdAt: toISOString(category.createdAt),
			updatedAt: toISOString(category.updatedAt),
		};
	}

	static toResponseWithCount(
		view: TodoCategoryWithCountView,
	): TodoCategoryWithCountDto {
		return {
			id: view.id,
			userId: view.userId,
			name: view.name,
			color: view.color,
			sortOrder: view.sortOrder,
			createdAt: toISOString(view.createdAt),
			updatedAt: toISOString(view.updatedAt),
			todoCount: view.todoCount,
		};
	}

	static toManyResponseWithCount(
		views: TodoCategoryWithCountView[],
	): TodoCategoryWithCountDto[] {
		return views.map((view) => TodoCategoryMapper.toResponseWithCount(view));
	}
}
