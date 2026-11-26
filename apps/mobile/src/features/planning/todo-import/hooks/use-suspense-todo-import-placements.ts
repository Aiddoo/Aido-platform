import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useGetTodoResourceLimitQueryOptionsFactory } from '@src/features/planning/todo/queries/todo.queries';
import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { zip } from 'es-toolkit';

import type { TodoImportPlacement } from '../domains/todo-import-placement.model';
import { type TodoImportPlan, TodoImportPlanPolicy } from '../domains/todo-import-plan.model';
import { createDefaultTarget } from '../domains/todo-import-target.model';
import { useNewCategoryDefaults } from './use-new-category-defaults';

interface TodoImportPlacementsInput {
  plan: TodoImportPlan;
}

// 고르지 않은 카테고리는 묻지 않고, 넣을 곳 카드·캘린더 줄·요약이 같은 키를 읽어 요청은 한 번이다
export function useSuspenseTodoImportPlacements({
  plan,
}: TodoImportPlacementsInput): TodoImportPlacement[] {
  const newCategoryDefaults = useNewCategoryDefaults();
  const getResourceLimitQueryOptions = useGetTodoResourceLimitQueryOptionsFactory();

  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  const defaultTarget = createDefaultTarget(categoriesResult.categories, newCategoryDefaults);
  const categoryIds = TodoImportPlanPolicy.findLimitCategoryIds(plan, defaultTarget);
  // 넣을 곳은 카테고리 목록을 받아야 정해져 한도 조회가 그 뒤에 나간다. 구조 공유가 되도록 Map이 아니라 배열로 모은다
  const limits = useSuspenseQueries({
    queries: categoryIds.map((categoryId) => getResourceLimitQueryOptions({ categoryId })),
    combine: (results) => results.map(({ data: limit }) => limit),
  });

  return TodoImportPlanPolicy.calculatePlacements(
    plan,
    defaultTarget,
    zip(categoryIds, limits).map(([categoryId, limit]) => ({ categoryId, limit })),
  );
}
