import {
  type TodoCategory,
  TodoCategoryPolicy,
} from '@src/features/planning/category/domains/todo-category.model';
import {
  type TodoResourceLimit,
  TodoResourceLimitPolicy,
} from '@src/features/planning/todo/domains/todo-resource-limit.model';
import { sumBy, uniq, uniqWith } from 'es-toolkit';
import { z } from 'zod';

import type { ImportCollection } from './todo-import-collection.model';

/** 새 카테고리는 확정할 때 서버가 만든다 */
export const importTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NEW_CATEGORY'), name: z.string(), color: z.string() }),
  z.object({ kind: z.literal('EXISTING_CATEGORY'), categoryId: z.int() }),
]);
export type ImportTarget = z.infer<typeof importTargetSchema>;

/** single: 고른 캘린더를 모두 한 곳에 넣는다(기본), separate: 캘린더마다 넣을 곳을 고른다 */
export const todoImportCategoryModeSchema = z.enum(['single', 'separate']);
export type TodoImportCategoryMode = z.infer<typeof todoImportCategoryModeSchema>;

export interface TargetPlacement {
  target: ImportTarget;
  /** 이곳을 고른 캘린더의 일정을 모두 더한 수 */
  importCount: number;
  /** 가져오기 전에 이곳에 더 넣을 수 있는 할 일 수 */
  roomLeft: number;
  /** 남은 자리만큼 실제로 들어가는 수 */
  placedCount: number;
  skippedCount: number;
  /** 가져온 뒤에도 남는 자리 */
  remainingCount: number;
}

function toComparableName(name: string) {
  return name.trim().toLocaleLowerCase();
}

/**
 * 처음 넣을 곳. 할 일을 새로 만들 때 처음 고르는 카테고리와 같고 새 카테고리는 만들지 않는다.
 * 만드는 중인 카테고리는 아직 id가 없어 고르지 않는다. 카테고리가 하나도 없을 때만 `newCategory`를 만든다
 */
export function getDefaultTarget(
  categories: readonly TodoCategory[],
  newCategory: ImportTarget,
): ImportTarget {
  const categoryId = TodoCategoryPolicy.findInitialCategoryId(
    categories.filter((category) => !TodoCategoryPolicy.isOptimisticCategory(category)),
    null,
  );
  return categoryId == null ? newCategory : { kind: 'EXISTING_CATEGORY', categoryId };
}

/** 캘린더가 하나뿐이면 나눌 것이 없어 한 곳에 넣는 것과 같다 */
export function resolveCategoryMode(
  collections: readonly ImportCollection[],
  categoryMode: TodoImportCategoryMode,
): TodoImportCategoryMode {
  return collections.length < 2 ? 'single' : categoryMode;
}

interface ImportTargetChoice {
  categoryMode: TodoImportCategoryMode;
  /** 모두 넣을 곳. null은 아직 고르지 않아 `fallbackTarget`이다 */
  singleTarget: ImportTarget | null;
  /** 캘린더마다 고른 곳. 고르지 않은 캘린더는 모두 넣을 곳이다 */
  targets: Readonly<Record<string, ImportTarget>>;
}

/**
 * 캘린더마다 넣을 곳. 한 곳에 넣으면 모두 그곳이고, 캘린더마다 넣어도 고르지 않은 캘린더는 그곳이다.
 * 캘린더마다 고른 값은 한 곳에 넣는 동안에도 남아 다시 나누면 돌아온다. 넣을 곳이 없으면 그 캘린더를 뺀다
 */
export function resolveImportTargets(
  collections: readonly ImportCollection[],
  { categoryMode, singleTarget, targets }: ImportTargetChoice,
  fallbackTarget: ImportTarget | null,
): Record<string, ImportTarget> {
  const destination = singleTarget ?? fallbackTarget;
  const isSeparate = resolveCategoryMode(collections, categoryMode) === 'separate';

  return Object.fromEntries(
    collections.flatMap((collection) => {
      const target = (isSeparate ? targets[collection.collectionKey] : null) ?? destination;
      return target == null ? [] : [[collection.collectionKey, target]];
    }),
  );
}

/** 서버에 한도를 물을 카테고리. 새 카테고리는 아직 없어 null이고 서버가 빈 카테고리로 센다 */
function findLimitCategoryId(target: ImportTarget): number | null {
  return target.kind === 'EXISTING_CATEGORY' ? target.categoryId : null;
}

/** 고른 넣을 곳마다 한 번만 한도를 묻는다. 새 카테고리는 몇 곳이어도 한 번이다 */
export function findLimitCategoryIds(
  targets: Readonly<Record<string, ImportTarget>>,
): (number | null)[] {
  return uniq(Object.values(targets).map(findLimitCategoryId));
}

/**
 * 고른 곳마다 넣을 일정 수와 실제로 들어가는 수. 같은 곳을 고른 캘린더는 합쳐 센다. 자리는 서버 한도(`limits`)다.
 * 넘쳐도 가져오기는 막지 않는다. 서버가 가까운 날짜부터 넣고 나머지를 건너뛴다. 한도를 모르는 곳은 세지 않는다
 */
export function placeImportTargets(
  collections: readonly ImportCollection[],
  targets: Readonly<Record<string, ImportTarget>>,
  limits: ReadonlyMap<number | null, TodoResourceLimit>,
): TargetPlacement[] {
  const assigned = collections.flatMap((collection) => {
    const target = targets[collection.collectionKey];
    return target == null ? [] : [{ collection, target }];
  });
  const uniqueTargets = uniqWith(
    assigned.map(({ target }) => target),
    (target, other) => TodoImportTargetPolicy.isSameTarget(target, other),
  );

  return uniqueTargets.flatMap((target) => {
    const limit = limits.get(findLimitCategoryId(target));
    if (limit == null) {
      return [];
    }
    const importCount = sumBy(
      assigned.filter((entry) => TodoImportTargetPolicy.isSameTarget(entry.target, target)),
      ({ collection }) => collection.itemCount,
    );
    const roomLeft = TodoResourceLimitPolicy.calculateRoomLeft(limit);
    const placedCount = Math.min(importCount, roomLeft);
    return [
      {
        target,
        importCount,
        roomLeft,
        placedCount,
        skippedCount: importCount - placedCount,
        remainingCount: roomLeft - placedCount,
      },
    ];
  });
}

interface ImportPlacementSummary {
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

/** 이 넣을 곳의 자리 계산. 이름이 같은 새 카테고리는 같은 곳이다 */
export function findTargetPlacement(
  placements: readonly TargetPlacement[],
  target: ImportTarget,
): TargetPlacement | null {
  return (
    placements.find((placement) => TodoImportTargetPolicy.isSameTarget(placement.target, target)) ??
    null
  );
}

/** 새로 만들 카테고리 수. 이름이 같은 새 카테고리는 서버가 하나로 만들어 한 번만 센다 */
export function countNewCategories(targets: readonly ImportTarget[]) {
  const names = targets.flatMap((target) =>
    target.kind === 'NEW_CATEGORY' ? [toComparableName(target.name)] : [],
  );
  return uniq(names).length;
}

export const TodoImportTargetPolicy = {
  isSameTarget(target: ImportTarget, other: ImportTarget): boolean {
    if (target.kind === 'NEW_CATEGORY' && other.kind === 'NEW_CATEGORY') {
      return toComparableName(target.name) === toComparableName(other.name);
    }
    if (target.kind === 'EXISTING_CATEGORY' && other.kind === 'EXISTING_CATEGORY') {
      return target.categoryId === other.categoryId;
    }
    return false;
  },

  /** 이름이 같은 카테고리(공백·대소문자 무시)가 있으면 새로 만들지 않고 그 카테고리에 넣는다 */
  findSameNameCategory<TCategory extends TodoCategory>(
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
  },

  /** 고른 카테고리가 목록에서 사라졌다(가져오기 전에 삭제했다). 새 카테고리는 아직 없어 사라질 수 없다 */
  isMissingCategory(target: ImportTarget, categories: readonly TodoCategory[]): boolean {
    return (
      target.kind === 'EXISTING_CATEGORY' &&
      TodoCategoryPolicy.findCategory(categories, target.categoryId) == null
    );
  },
};
