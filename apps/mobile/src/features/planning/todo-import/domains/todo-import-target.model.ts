import { TODO_LIMITS } from '@aido/api/vocabulary';
import {
  type TodoCategory,
  TodoCategoryPolicy,
  type TodoCategoryWithCount,
} from '@src/features/planning/category/domains/todo-category.model';
import { keyBy, sumBy, uniqWith } from 'es-toolkit';
import { z } from 'zod';

import type { ImportCollection } from './todo-import-collection.model';

/** 새 카테고리는 확정할 때 서버가 만든다 */
export const importTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NEW_CATEGORY'), name: z.string(), color: z.string() }),
  z.object({ kind: z.literal('EXISTING_CATEGORY'), categoryId: z.int() }),
]);
export type ImportTarget = z.infer<typeof importTargetSchema>;

/** 새 카테고리의 이름·색은 mapper가 채운다 */
export type ImportTargetSuggestion =
  | { kind: 'NEW_CATEGORY' }
  | { kind: 'EXISTING_CATEGORY'; categoryId: number };

interface SuggestTargetsContext {
  categories: readonly TodoCategory[];
  /** null은 제한이 없다 */
  remainingCategorySlots: number | null;
  /** 캘린더마다 새 카테고리로 만들 때 보낼 이름. 이메일 같은 캘린더 이름은 이미 바뀌어 있다 */
  newCategoryNames: Readonly<Record<string, string>>;
}

function toComparableName(name: string) {
  return name.trim().toLocaleLowerCase();
}

/**
 * 캘린더마다 처음 연결할 곳(순서대로 채운다).
 * 같은 이름의 카테고리 → 남은 카테고리 자리가 있으면 새 카테고리 → 꽉 찼으면 첫 카테고리.
 * 이름은 새 카테고리로 보낼 이름과 같은 값으로 견준다
 */
export function suggestTargets(
  collections: readonly ImportCollection[],
  { categories, remainingCategorySlots, newCategoryNames }: SuggestTargetsContext,
): Record<string, ImportTargetSuggestion> {
  const categoriesByName = keyBy(
    categories.filter((category) => !TodoCategoryPolicy.isOptimisticCategory(category)),
    (category) => toComparableName(category.name),
  );
  const fallbackCategoryId = TodoCategoryPolicy.findInitialCategoryId(categories, null);
  let newCategoryCount = 0;

  return Object.fromEntries(
    collections.map((collection): [string, ImportTargetSuggestion] => {
      const name = newCategoryNames[collection.collectionKey];
      const sameNameCategory = name == null ? null : categoriesByName[toComparableName(name)];
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

/**
 * 카테고리 하나에 넣을 수 있는 할 일 수(`TODO_LIMITS.MAX_PER_CATEGORY`)를 넘을 수 있는 대상이 있다.
 * 넘쳐도 서버가 가까운 날짜부터 넣고 나머지를 건너뛰어 막지 않는다. 기존 카테고리의 수는 완료한 할 일까지
 * 센 값이라 실제로는 자리가 남을 수도 있다
 */
export function hasTargetOverCapacity(
  collections: readonly ImportCollection[],
  targets: Readonly<Record<string, ImportTarget>>,
  categories: readonly TodoCategoryWithCount[],
): boolean {
  const assigned = collections.flatMap((collection) => {
    const target = targets[collection.collectionKey];
    return target == null ? [] : [{ collection, target }];
  });
  const uniqueTargets = uniqWith(
    assigned.map(({ target }) => target),
    isSameTarget,
  );

  return uniqueTargets.some((target) => {
    const importCount = sumBy(
      assigned.filter((entry) => isSameTarget(entry.target, target)),
      ({ collection }) => collection.itemCount,
    );
    const currentCount =
      target.kind === 'EXISTING_CATEGORY'
        ? (TodoCategoryPolicy.findCategory(categories, target.categoryId)?.todoCount ?? 0)
        : 0;
    return TODO_LIMITS.MAX_PER_CATEGORY < currentCount + importCount;
  });
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

/** 이름이 같은 카테고리가 있으면 새로 만들지 않고 그 카테고리에 넣는다(`suggestTargets`와 같게 견준다) */
function findSameNameCategory<TCategory extends TodoCategory>(
  target: ImportTarget,
  categories: readonly TCategory[],
): TCategory | null {
  if (target.kind !== 'NEW_CATEGORY') {
    return null;
  }
  const name = toComparableName(target.name);
  return (
    categories.find(
      (category) =>
        !TodoCategoryPolicy.isOptimisticCategory(category) &&
        toComparableName(category.name) === name,
    ) ?? null
  );
}

export const TodoImportTargetPolicy = {
  countNewCategories,
  isSameTarget,
  findSameNameCategory,
} as const;
