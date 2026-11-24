import { useGetTodoResourceLimitQueryOptionsFactory } from '@src/features/planning/todo/queries/todo.queries';
import { useSuspenseQueries } from '@tanstack/react-query';

import type { ImportCollection } from '../domains/todo-import-collection.model';
import {
  findLimitCategoryIds,
  type ImportTarget,
  placeImportTargets,
  type TargetPlacement,
} from '../domains/todo-import-target.model';

/**
 * 고른 넣을 곳마다 서버 한도를 한 번씩 읽어 몇 개가 들어가고 몇 개를 건너뛰는지 센다. 고르지 않은 카테고리는 묻지 않고,
 * 넣을 곳 카드·캘린더 줄·요약이 같은 키를 읽어 요청은 한 번이다
 */
export function useImportPlacements(
  collections: readonly ImportCollection[],
  targets: Readonly<Record<string, ImportTarget>>,
): TargetPlacement[] {
  const getResourceLimitQueryOptions = useGetTodoResourceLimitQueryOptionsFactory();
  const categoryIds = findLimitCategoryIds(targets);
  const limits = useSuspenseQueries({
    queries: categoryIds.map((categoryId) => getResourceLimitQueryOptions({ categoryId })),
    combine: (results) =>
      new Map(results.map(({ data: limit }, index) => [categoryIds[index] ?? null, limit])),
  });

  return placeImportTargets(collections, targets, limits);
}
