import type { todoCommentLike as todoCommentLikeTable } from "#api/platform/database/schema/engagement.schema";

import { TodoCommentLike } from "../../domain/todo-comment-like.aggregate.js";

type TodoCommentLikeRow = typeof todoCommentLikeTable.$inferSelect;
type TodoCommentLikeInsertRow = typeof todoCommentLikeTable.$inferInsert;

export function toTodoCommentLike(row: TodoCommentLikeRow): TodoCommentLike {
  return TodoCommentLike.reconstitute(row);
}

export function toTodoCommentLikeRow(like: TodoCommentLike): TodoCommentLikeInsertRow {
  return like.toPrimitives();
}
