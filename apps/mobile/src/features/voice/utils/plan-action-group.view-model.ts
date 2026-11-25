import { groupBy, uniq } from 'es-toolkit';

import {
  getPlannedCategoryId,
  type PlannedMemo,
  type PlannedTodo,
} from '../domains/voice-plan.model';

// 고르기 시트의 폼 카드도 묶어 종류와 카테고리만 받는다
type PlanGroupableAction = Pick<PlannedTodo, 'type' | 'categoryId'> | Pick<PlannedMemo, 'type'>;

/** 한 카테고리의 카드들. 메모는 카테고리가 없어 `categoryId`가 null인 묶음으로 맨 뒤에 모인다 */
interface PlanActionGroup {
  categoryId: number | null;
  /** 폼 배열에서의 자리. 묶어 보여도 카드를 고칠 때는 이 자리를 쓴다 */
  indexes: number[];
}

export function getPlanActionGroups(
  actions: readonly PlanGroupableAction[],
  fallbackCategoryId: number,
): PlanActionGroup[] {
  const memoIndexes = actions.flatMap((action, index) =>
    action.type === 'create-memo' ? [index] : [],
  );
  const todos = actions.flatMap((action, index) =>
    action.type === 'create-memo'
      ? []
      : [{ index, categoryId: getPlannedCategoryId(action.categoryId, fallbackCategoryId) }],
  );
  const todosByCategory = groupBy(todos, ({ categoryId }) => categoryId);
  // 숫자 키 객체는 오름차순으로 돌아 먼저 말한 카테고리 순서를 잃는다. 순서는 uniq로 따로 지킨다
  const groups: PlanActionGroup[] = uniq(todos.map(({ categoryId }) => categoryId)).map(
    (categoryId) => ({
      categoryId,
      indexes: (todosByCategory[categoryId] ?? []).map(({ index }) => index),
    }),
  );
  return memoIndexes.length === 0
    ? groups
    : [...groups, { categoryId: null, indexes: memoIndexes }];
}

// 화면에 묶어 보인 순서대로 늘어놓는다. 저장 순서가 사용자가 본 순서와 같아진다
export function sortPlanActionsByGroup<TAction extends PlanGroupableAction>(
  actions: readonly TAction[],
  fallbackCategoryId: number,
): TAction[] {
  return getPlanActionGroups(actions, fallbackCategoryId).flatMap(({ indexes }) =>
    indexes.flatMap((index) => actions.slice(index, index + 1)),
  );
}
