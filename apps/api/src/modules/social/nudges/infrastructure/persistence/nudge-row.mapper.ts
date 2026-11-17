import type { TodoBriefReadModel } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { nudge as nudgeTable } from "#api/platform/database/schema/index";

import type { NudgeInteractionTodoReadModel } from "../../application/read-models/nudge-interaction.read-model.js";
import { NudgeTargetTodo } from "../../domain/nudge-target-todo.vo.js";
import { Nudge } from "../../domain/nudge.aggregate.js";

type NudgeRow = typeof nudgeTable.$inferSelect;
type NudgeInsertRow = typeof nudgeTable.$inferInsert;

export function toNudge(row: NudgeRow): Nudge {
  return Nudge.reconstitute(row);
}

export function toNudgeRow(nudge: Nudge): NudgeInsertRow {
  return nudge.toPrimitives();
}

// 콕 대상 할 일은 planning 조회 포트가 준 요약에서 복원한다
export function toNudgeTargetTodo(todo: TodoBriefReadModel): NudgeTargetTodo {
  return NudgeTargetTodo.reconstitute({
    ownerId: todo.ownerId.value,
    title: todo.title,
    visibility: todo.visibility,
    startDate: todo.startDate,
    endDate: todo.endDate,
  });
}

export function toNudgeInteractionTodoReadModel(
  todo: TodoBriefReadModel,
): NudgeInteractionTodoReadModel {
  return {
    id: todo.todoId.value,
    ownerId: todo.ownerId.value,
    title: todo.title,
    completed: todo.completed,
    visibility: todo.visibility,
  };
}
