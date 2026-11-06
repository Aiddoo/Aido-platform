import { type PlanSelection, type VoicePlan, VoicePlanPolicy } from '../domains/voice-plan.model';

export type PlanHeadline =
  | { kind: 'todos'; count: number }
  | { kind: 'memo' }
  | { kind: 'already-added' };

/** 계획 카드 위 머리글이 말할 내용. 문구는 화면이 고른다 */
export function getPlanHeadline(plan: VoicePlan, selection: PlanSelection): PlanHeadline {
  const selectedTodoCount = VoicePlanPolicy.countSelectedTodos(plan, selection);
  if (selectedTodoCount > 0) {
    return { kind: 'todos', count: selectedTodoCount };
  }
  if (VoicePlanPolicy.getSelectedActions(plan, selection).length > 0) {
    return { kind: 'memo' };
  }
  const todos = plan.actions.filter(VoicePlanPolicy.isTodoAction);
  if (todos.length === 0) {
    return { kind: 'memo' };
  }
  return todos.every(VoicePlanPolicy.isDuplicateAction)
    ? { kind: 'already-added' }
    : { kind: 'todos', count: todos.length };
}
