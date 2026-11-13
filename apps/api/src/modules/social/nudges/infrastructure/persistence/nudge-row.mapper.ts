import type { nudge as nudgeTable, todo as todoTable } from "#api/platform/database/schema/index";

import { NudgeTargetTodo } from "../../domain/nudge-target-todo.vo.js";
import { Nudge } from "../../domain/nudge.aggregate.js";

type NudgeRow = typeof nudgeTable.$inferSelect;
type NudgeInsertRow = typeof nudgeTable.$inferInsert;
type TodoRow = typeof todoTable.$inferSelect;

export function toNudge(row: NudgeRow): Nudge {
  return Nudge.reconstitute(row);
}

export function toNudgeRow(nudge: Nudge): NudgeInsertRow {
  return nudge.toPrimitives();
}

export function toNudgeTargetTodo(
  row: Pick<TodoRow, "userId" | "title" | "visibility" | "startDate" | "endDate">,
): NudgeTargetTodo {
  return NudgeTargetTodo.reconstitute({
    ownerId: row.userId,
    title: row.title,
    visibility: row.visibility,
    startDate: row.startDate,
    endDate: row.endDate,
  });
}
