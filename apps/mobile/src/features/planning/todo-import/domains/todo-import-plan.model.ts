import type { TodoCategory } from '@src/features/planning/category/domains/todo-category.model';
import type { TodoResourceLimit } from '@src/features/planning/todo/domains/todo-resource-limit.model';
import { sumBy, uniq, uniqWith } from 'es-toolkit';
import { z } from 'zod';

import { todoImportCollectionSchema } from './todo-import-collection.model';
import { createTodoImportPlacement, type TodoImportPlacement } from './todo-import-placement.model';
import {
  type TodoImportTarget,
  TodoImportTargetPolicy,
  todoImportTargetSchema,
} from './todo-import-target.model';

// single: 고른 캘린더를 모두 한 곳에 넣는다(기본), separate: 캘린더마다 넣을 곳을 고른다
const todoImportCategoryModeSchema = z.enum(['single', 'separate']);
export type TodoImportCategoryMode = z.infer<typeof todoImportCategoryModeSchema>;

// 무엇을 어디에 넣는지. 캘린더 단계를 넘길 때 고른 캘린더(일정 수 포함)를 collections에 고정한다
export const todoImportPlanSchema = z.object({
  collections: z.array(todoImportCollectionSchema),
  categoryMode: todoImportCategoryModeSchema,
  // 모두 넣을 곳. null은 아직 고르지 않아 기본 넣을 곳이고, 카테고리 단계를 넘길 때 고정한다
  singleTarget: todoImportTargetSchema.nullable(),
  // 캘린더마다 고른 곳. 없는 캘린더는 모두 넣을 곳이다. 한 곳에 넣는 동안에도 남겨 다시 나누면 돌아온다
  targets: z.record(z.string(), todoImportTargetSchema),
});
export type TodoImportPlan = z.infer<typeof todoImportPlanSchema>;

export interface TodoImportCategoryLimit {
  // 새 카테고리는 아직 없어 null이다
  categoryId: number | null;
  limit: TodoResourceLimit;
}

const MIN_SPLITTABLE_COLLECTION_COUNT = 2;

export const TodoImportPlanPolicy = {
  // 캘린더가 하나뿐이면 나눌 것이 없다
  canSplit(plan: TodoImportPlan): boolean {
    return MIN_SPLITTABLE_COLLECTION_COUNT <= plan.collections.length;
  },

  // 나눌 수 없으면 나눠 넣기를 골랐어도 한 곳에 넣는다
  getCategoryMode(plan: TodoImportPlan): TodoImportCategoryMode {
    return this.canSplit(plan) ? plan.categoryMode : 'single';
  },

  getDestination(plan: TodoImportPlan, defaultTarget: TodoImportTarget): TodoImportTarget {
    return plan.singleTarget ?? defaultTarget;
  },

  // 나눠 넣어도 고르지 않은 캘린더는 기본 넣을 곳이고, 넣을 곳이 없으면(defaultTarget도 null) 그 캘린더를 뺀다
  getAssignedTargets(
    plan: TodoImportPlan,
    defaultTarget: TodoImportTarget | null,
  ): Record<string, TodoImportTarget> {
    const destination = plan.singleTarget ?? defaultTarget;
    const isSeparate = this.getCategoryMode(plan) === 'separate';

    return Object.fromEntries(
      plan.collections.flatMap(({ collectionKey }) => {
        const target = (isSeparate ? plan.targets[collectionKey] : null) ?? destination;
        return target == null ? [] : [[collectionKey, target]];
      }),
    );
  },

  findTarget(
    plan: TodoImportPlan,
    defaultTarget: TodoImportTarget,
    collectionKey: string,
  ): TodoImportTarget | null {
    return this.getAssignedTargets(plan, defaultTarget)[collectionKey] ?? null;
  },

  // 새 카테고리를 더 만들 수 있는지 셀 때 다른 캘린더가 가리키는 곳을 함께 센다
  getOtherTargets(
    plan: TodoImportPlan,
    defaultTarget: TodoImportTarget,
    collectionKey: string,
  ): TodoImportTarget[] {
    const targets = this.getAssignedTargets(plan, defaultTarget);

    return plan.collections.flatMap((collection) => {
      const target = targets[collection.collectionKey];
      return collection.collectionKey === collectionKey || target == null ? [] : [target];
    });
  },

  // 고른 카테고리를 그사이 삭제했다
  hasMissingCategory(
    plan: TodoImportPlan,
    defaultTarget: TodoImportTarget,
    categories: readonly TodoCategory[],
  ): boolean {
    return Object.values(this.getAssignedTargets(plan, defaultTarget)).some((target) =>
      TodoImportTargetPolicy.isMissingCategory(target, categories),
    );
  },

  // 고른 넣을 곳마다 한 번만 한도를 묻는다. 새 카테고리는 몇 곳이어도 한 번(null)이다
  findLimitCategoryIds(plan: TodoImportPlan, defaultTarget: TodoImportTarget): (number | null)[] {
    return uniq(
      Object.values(this.getAssignedTargets(plan, defaultTarget)).map((target) =>
        TodoImportTargetPolicy.findLimitCategoryId(target),
      ),
    );
  },

  // 고른 곳마다 넣을 일정 수와 실제로 들어가는 수. 같은 곳을 고른 캘린더는 합쳐 세고 한도를 모르는 곳은 세지 않는다
  calculatePlacements(
    plan: TodoImportPlan,
    defaultTarget: TodoImportTarget,
    categoryLimits: readonly TodoImportCategoryLimit[],
  ): TodoImportPlacement[] {
    const targets = this.getAssignedTargets(plan, defaultTarget);
    const assigned = plan.collections.flatMap((collection) => {
      const target = targets[collection.collectionKey];
      return target == null ? [] : [{ collection, target }];
    });
    const uniqueTargets = uniqWith(
      assigned.map(({ target }) => target),
      (target, other) => TodoImportTargetPolicy.isSameTarget(target, other),
    );

    return uniqueTargets.flatMap((target) => {
      const categoryId = TodoImportTargetPolicy.findLimitCategoryId(target);
      const categoryLimit = categoryLimits.find((entry) => entry.categoryId === categoryId);
      if (categoryLimit == null) {
        return [];
      }
      const importCount = sumBy(
        assigned.filter((entry) => TodoImportTargetPolicy.isSameTarget(entry.target, target)),
        ({ collection }) => collection.itemCount,
      );
      return [createTodoImportPlacement(target, importCount, categoryLimit.limit)];
    });
  },
};
