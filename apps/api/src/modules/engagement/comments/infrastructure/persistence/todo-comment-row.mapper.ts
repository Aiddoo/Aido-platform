import type {
  todoComment as todoCommentTable,
  todoCommentLike as todoCommentLikeTable,
} from "#api/platform/database/schema/engagement.schema";

import { TodoCommentLike } from "../../domain/todo-comment-like.entity.js";
import { TodoComment } from "../../domain/todo-comment.aggregate.js";

type TodoCommentRow = typeof todoCommentTable.$inferSelect;
type TodoCommentInsertRow = typeof todoCommentTable.$inferInsert;
type TodoCommentLikeRow = typeof todoCommentLikeTable.$inferSelect;
type TodoCommentLikeInsertRow = typeof todoCommentLikeTable.$inferInsert;

export function toTodoComment(row: TodoCommentRow): TodoComment {
  return TodoComment.reconstitute(row);
}

export function toTodoCommentRow(comment: TodoComment): TodoCommentInsertRow {
  return comment.toPrimitives();
}

export function toTodoCommentLike(row: TodoCommentLikeRow): TodoCommentLike {
  return TodoCommentLike.reconstitute(row);
}

export function toTodoCommentLikeRow(like: TodoCommentLike): TodoCommentLikeInsertRow {
  return like.toPrimitives();
}
