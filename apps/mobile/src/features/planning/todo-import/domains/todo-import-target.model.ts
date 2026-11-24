import { TODO_LIMITS } from '@aido/api/vocabulary';
import {
  type TodoCategory,
  TodoCategoryPolicy,
  type TodoCategoryWithCount,
} from '@src/features/planning/category/domains/todo-category.model';
import { sumBy, uniqWith } from 'es-toolkit';
import { z } from 'zod';

import type { ImportCollection } from './todo-import-collection.model';

/** 새 카테고리는 확정할 때 서버가 만든다 */
export const importTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NEW_CATEGORY'), name: z.string(), color: z.string() }),
  z.object({ kind: z.literal('EXISTING_CATEGORY'), categoryId: z.int() }),
]);
export type ImportTarget = z.infer<typeof importTargetSchema>;

export interface TargetPlacement {
  target: ImportTarget;
  /** 이곳을 고른 캘린더의 일정을 모두 더한 수 */
  importCount: number;
  /** 카테고리에 남은 자리만큼 실제로 들어가는 수 */
  placedCount: number;
  skippedCount: number;
}

function toComparableName(name: string) {
  return name.trim().toLocaleLowerCase();
}

/**
 * 처음 넣을 곳. 할 일을 새로 만들 때 처음 고르는 카테고리와 같고 새 카테고리는 만들지 않는다.
 * 만드는 중인 카테고리는 아직 id가 없어 고르지 않는다. 카테고리가 하나도 없으면 null이다
 */
export function findDefaultTarget(categories: readonly TodoCategory[]): ImportTarget | null {
  const categoryId = TodoCategoryPolicy.findInitialCategoryId(
    categories.filter((category) => !TodoCategoryPolicy.isOptimisticCategory(category)),
    null,
  );
  return categoryId == null ? null : { kind: 'EXISTING_CATEGORY', categoryId };
}

/**
 * 카테고리 하나에 더 넣을 수 있는 할 일 수(`TODO_LIMITS.MAX_PER_CATEGORY`까지). 새 카테고리는 비어 있다.
 * 기존 카테고리의 수는 완료한 할 일까지 센 값이라 실제로는 자리가 더 남을 수도 있다
 */
function calculateRoomLeft(target: ImportTarget, categories: readonly TodoCategoryWithCount[]) {
  if (target.kind === 'NEW_CATEGORY') {
    return TODO_LIMITS.MAX_PER_CATEGORY;
  }
  const todoCount = TodoCategoryPolicy.findCategory(categories, target.categoryId)?.todoCount ?? 0;
  return Math.max(0, TODO_LIMITS.MAX_PER_CATEGORY - todoCount);
}

/**
 * 고른 곳마다 넣을 일정 수와 실제로 들어가는 수. 같은 곳을 고른 캘린더는 합쳐 센다.
 * 넘쳐도 가져오기는 막지 않는다. 서버가 가까운 날짜부터 넣고 나머지를 건너뛴다
 */
export function placeImportTargets(
  collections: readonly ImportCollection[],
  targets: Readonly<Record<string, ImportTarget>>,
  categories: readonly TodoCategoryWithCount[],
): TargetPlacement[] {
  const assigned = collections.flatMap((collection) => {
    const target = targets[collection.collectionKey];
    return target == null ? [] : [{ collection, target }];
  });
  const uniqueTargets = uniqWith(
    assigned.map(({ target }) => target),
    isSameTarget,
  );

  return uniqueTargets.map((target) => {
    const importCount = sumBy(
      assigned.filter((entry) => isSameTarget(entry.target, target)),
      ({ collection }) => collection.itemCount,
    );
    const placedCount = Math.min(importCount, calculateRoomLeft(target, categories));
    return { target, importCount, placedCount, skippedCount: importCount - placedCount };
  });
}

export interface ImportPlacementSummary {
  totalCount: number;
  placedCount: number;
  /** 일정이 들어가는 아이두 카테고리 수 */
  destinationCount: number;
}

/** 모두 몇 개를 몇 곳에 넣는지, 자리가 모자라 실제로 몇 개만 들어가는지 */
export function summarizePlacements(
  placements: readonly TargetPlacement[],
): ImportPlacementSummary {
  return {
    totalCount: sumBy(placements, ({ importCount }) => importCount),
    placedCount: sumBy(placements, ({ placedCount }) => placedCount),
    destinationCount: placements.length,
  };
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

/** 이름이 같은 카테고리(공백·대소문자 무시)가 있으면 새로 만들지 않고 그 카테고리에 넣는다 */
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

/** 고른 카테고리가 목록에서 사라졌다(가져오기 전에 삭제했다). 새 카테고리는 아직 없어 사라질 수 없다 */
function isMissingCategory(target: ImportTarget, categories: readonly TodoCategory[]) {
  return (
    target.kind === 'EXISTING_CATEGORY' &&
    TodoCategoryPolicy.findCategory(categories, target.categoryId) == null
  );
}

export const TodoImportTargetPolicy = {
  calculateRoomLeft,
  countNewCategories,
  isSameTarget,
  findSameNameCategory,
  isMissingCategory,
} as const;
