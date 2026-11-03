import { todoCommentRepliesResponseSchema, todoCommentThreadsResponseSchema } from "@aido/api";
import type { z } from "zod";

export const TodoCommentThreadsResponseDto = todoCommentThreadsResponseSchema.meta({
  id: "TodoCommentThreadsResponseDto",
});
export type TodoCommentThreadsResponseDto = z.infer<typeof TodoCommentThreadsResponseDto>;
export const TodoCommentRepliesResponseDto = todoCommentRepliesResponseSchema.meta({
  id: "TodoCommentRepliesResponseDto",
});
export type TodoCommentRepliesResponseDto = z.infer<typeof TodoCommentRepliesResponseDto>;
