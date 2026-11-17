import {
  getTodoCommentRepliesQuerySchema,
  getTodoCommentThreadsQuerySchema,
  todoCommentRepliesResponseSchema,
  todoCommentThreadsResponseSchema,
} from "@aido/api/contracts/todo-comment";
import type { z } from "zod";

export const GetTodoCommentThreadsQueryDto = getTodoCommentThreadsQuerySchema.meta({
  id: "GetTodoCommentThreadsQueryDto",
  apiParameter: true,
});
export type GetTodoCommentThreadsQueryDto = z.infer<typeof GetTodoCommentThreadsQueryDto>;
export const GetTodoCommentRepliesQueryDto = getTodoCommentRepliesQuerySchema.meta({
  id: "GetTodoCommentRepliesQueryDto",
  apiParameter: true,
});
export type GetTodoCommentRepliesQueryDto = z.infer<typeof GetTodoCommentRepliesQueryDto>;

export const TodoCommentThreadsResponseDto = todoCommentThreadsResponseSchema.meta({
  id: "TodoCommentThreadsResponseDto",
});
export type TodoCommentThreadsResponseDto = z.infer<typeof TodoCommentThreadsResponseDto>;
export const TodoCommentRepliesResponseDto = todoCommentRepliesResponseSchema.meta({
  id: "TodoCommentRepliesResponseDto",
});
export type TodoCommentRepliesResponseDto = z.infer<typeof TodoCommentRepliesResponseDto>;
