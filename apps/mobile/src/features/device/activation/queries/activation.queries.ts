import type { TodoOverview } from '@src/features/planning/todo/domains/todo-overview.model';

import type { ActivationTodoRecord } from '../domains/activation.model';

/** 반복 여부만 바뀌면 체크리스트를 다시 그리지 않는다 */
export function selectActivationTodoRecord({
  hasTodo,
  hasCompletedTodo,
}: TodoOverview): ActivationTodoRecord {
  return { hasTodo, hasCompletedTodo };
}
