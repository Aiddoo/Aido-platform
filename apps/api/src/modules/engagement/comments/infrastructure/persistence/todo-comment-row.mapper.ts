import type { todoComment as todoCommentTable } from "#api/platform/database/schema/engagement.schema";

import { TodoComment } from "../../domain/todo-comment.aggregate.js";

type TodoCommentRow = typeof todoCommentTable.$inferSelect;
type TodoCommentInsertRow = typeof todoCommentTable.$inferInsert;

export function toTodoComment(row: TodoCommentRow): TodoComment {
  return TodoComment.reconstitute(row);
}

export function toTodoCommentRow(comment: TodoComment): TodoCommentInsertRow {
  return comment.toPrimitives();
}
