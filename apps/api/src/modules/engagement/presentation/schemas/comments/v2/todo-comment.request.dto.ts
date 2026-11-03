import { getTodoCommentRepliesQuerySchema, getTodoCommentThreadsQuerySchema } from "@aido/api";
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
