import {
  type TodoCategory,
  TodoCategoryPolicy,
} from '@src/features/planning/category/domains/todo-category.model';
import { keyBy } from 'es-toolkit';
import { z } from 'zod';

import type { ImportCollection } from './todo-import-collection.model';

/** 캘린더 하나의 일정을 넣을 곳. 새 카테고리는 확정할 때 서버가 만든다 */
export const importTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NEW_CATEGORY'), name: z.string(), color: z.string() }),
  z.object({ kind: z.literal('EXISTING_CATEGORY'), categoryId: z.int() }),
]);
export type ImportTarget = z.infer<typeof importTargetSchema>;

/** 기본 연결이 고른 종류. 새 카테고리의 이름·색은 mapper가 캘린더 이름·가까운 색으로 채운다 */
export type ImportTargetSuggestion =
  | { kind: 'NEW_CATEGORY' }
  | { kind: 'EXISTING_CATEGORY'; categoryId: number };

interface SuggestTargetsContext {
  categories: readonly TodoCategory[];
  /** 서버 `TODO_CATEGORY.remaining`. null은 제한이 없다 */
  remainingCategorySlots: number | null;
}

/** 앞뒤 공백과 대소문자를 무시하고 같은 이름이면 같은 카테고리로 본다 */
function toComparableName(name: string) {
  return name.trim().toLocaleLowerCase();
}

/**
 * 캘린더마다 처음 연결할 곳(순서대로 채운다).
 * 같은 이름의 카테고리 → 남은 카테고리 자리가 있으면 새 카테고리 → 꽉 찼으면 첫 카테고리
 */
function suggestTargets(
  collections: readonly ImportCollection[],
  { categories, remainingCategorySlots }: SuggestTargetsContext,
): Record<string, ImportTargetSuggestion> {
  const categoriesByName = keyBy(
    categories.filter((category) => !TodoCategoryPolicy.isOptimisticCategory(category)),
    (category) => toComparableName(category.name),
  );
  const fallbackCategoryId = TodoCategoryPolicy.findInitialCategoryId(categories, null);
  let newCategoryCount = 0;

  return Object.fromEntries(
    collections.map((collection): [string, ImportTargetSuggestion] => {
      const sameNameCategory = categoriesByName[toComparableName(collection.title)];
      if (sameNameCategory != null) {
        return [
          collection.collectionKey,
          { kind: 'EXISTING_CATEGORY', categoryId: sameNameCategory.id },
        ];
      }
      const hasSlot = remainingCategorySlots == null || newCategoryCount < remainingCategorySlots;
      if (hasSlot || fallbackCategoryId == null) {
        newCategoryCount += 1;
        return [collection.collectionKey, { kind: 'NEW_CATEGORY' }];
      }
      return [
        collection.collectionKey,
        { kind: 'EXISTING_CATEGORY', categoryId: fallbackCategoryId },
      ];
    }),
  );
}

/** 이름이 같은 새 카테고리는 서버가 하나로 만들어 한 번만 센다 */
function countNewCategories(targets: readonly ImportTarget[]) {
  const names = targets.flatMap((target) =>
    target.kind === 'NEW_CATEGORY' ? [toComparableName(target.name)] : [],
  );
  return new Set(names).size;
}

function isSameTarget(target: ImportTarget, other: ImportTarget) {
  if (target.kind === 'NEW_CATEGORY' && other.kind === 'NEW_CATEGORY') {
    return toComparableName(target.name) === toComparableName(other.name);
  }
  if (target.kind === 'EXISTING_CATEGORY' && other.kind === 'EXISTING_CATEGORY') {
    return target.categoryId === other.categoryId;
  }
  return false;
}

export const TodoImportTargetPolicy = { suggestTargets, countNewCategories, isSameTarget } as const;
