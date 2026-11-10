/**
 * TodoCategory 프레젠테이션 매퍼 — 애플리케이션 타입 → API 응답(@aido/api). 계약 불변.
 */
import type {
  TodoCategory as TodoCategoryDto,
  TodoCategoryWithCount as TodoCategoryWithCountDto,
} from "@aido/api";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { TodoCategoryWithCountReadModel } from "../../../application/read-models/todo-category-with-count.read-model.js";
import type { TodoCategory } from "../../../domain/todo-category.aggregate.js";

export const TodoCategoryMapper = {
  toResponse(category: TodoCategory): TodoCategoryDto {
    const { id, userId, name, color, sortOrder, createdAt, updatedAt } = category.toPrimitives();
    return {
      id,
      userId,
      name,
      color,
      sortOrder,
      createdAt: toIsoString(createdAt),
      updatedAt: toIsoString(updatedAt),
    };
  },

  toResponseWithCount(view: TodoCategoryWithCountReadModel): TodoCategoryWithCountDto {
    return {
      id: view.id,
      userId: view.userId,
      name: view.name,
      color: view.color,
      sortOrder: view.sortOrder,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
      todoCount: view.todoCount,
    };
  },

  toManyResponseWithCount(views: TodoCategoryWithCountReadModel[]): TodoCategoryWithCountDto[] {
    return views.map((view) => TodoCategoryMapper.toResponseWithCount(view));
  },
};
