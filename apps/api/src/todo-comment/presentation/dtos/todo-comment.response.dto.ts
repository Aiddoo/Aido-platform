import {
  deleteTodoCommentResponseSchema,
  todoCommentChainResponseSchema,
  todoCommentLikeResponseSchema,
  todoCommentMutationResponseSchema,
  todoCommentOverviewResponseSchema,
  todoConversationResponseSchema,
  todoDetailsResponseSchema,
} from "@aido/validators";
import type { z } from "zod";

export const TodoDetailsResponseDto = todoDetailsResponseSchema.meta({
  id: "TodoDetailsResponseDto",
});
export type TodoDetailsResponseDto = z.infer<typeof TodoDetailsResponseDto>;
export const TodoCommentOverviewResponseDto = todoCommentOverviewResponseSchema.meta({
  id: "TodoCommentOverviewResponseDto",
});
export type TodoCommentOverviewResponseDto = z.infer<typeof TodoCommentOverviewResponseDto>;
export const TodoConversationResponseDto = todoConversationResponseSchema.meta({
  id: "TodoConversationResponseDto",
});
export type TodoConversationResponseDto = z.infer<typeof TodoConversationResponseDto>;
export const TodoCommentChainResponseDto = todoCommentChainResponseSchema.meta({
  id: "TodoCommentChainResponseDto",
});
export type TodoCommentChainResponseDto = z.infer<typeof TodoCommentChainResponseDto>;
export const TodoCommentMutationResponseDto = todoCommentMutationResponseSchema.meta({
  id: "TodoCommentMutationResponseDto",
});
export type TodoCommentMutationResponseDto = z.infer<typeof TodoCommentMutationResponseDto>;
export const TodoCommentLikeResponseDto = todoCommentLikeResponseSchema.meta({
  id: "TodoCommentLikeResponseDto",
});
export type TodoCommentLikeResponseDto = z.infer<typeof TodoCommentLikeResponseDto>;
export const DeleteTodoCommentResponseDto = deleteTodoCommentResponseSchema.meta({
  id: "DeleteTodoCommentResponseDto",
});
export type DeleteTodoCommentResponseDto = z.infer<typeof DeleteTodoCommentResponseDto>;
