import type { TodoCategoryWithCount } from '@aido/validators';

import type { TodoCategoryItem } from '../models/todo-category.model';

/** 서버 TodoCategory DTO → 프론트엔드 TodoCategoryItem 도메인 모델 */
export const toTodoCategoryItem = (dto: TodoCategoryWithCount): TodoCategoryItem => ({
  id: dto.id,
  name: dto.name,
  color: dto.color,
  sortOrder: dto.sortOrder,
  todoCount: dto.todoCount,
});

/** 서버 TodoCategory DTO 배열 → 프론트엔드 TodoCategoryItem 도메인 모델 배열 */
export const toTodoCategoryItems = (dtos: TodoCategoryWithCount[]): TodoCategoryItem[] =>
  dtos.map(toTodoCategoryItem);
