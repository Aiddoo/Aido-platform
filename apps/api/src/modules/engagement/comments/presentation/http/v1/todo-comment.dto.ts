import {
  createTodoCommentChainSchema,
  deleteTodoCommentResponseSchema,
  getTodoCommentOverviewQuerySchema,
  getTodoConversationQuerySchema,
  todoCommentChainResponseSchema,
  todoCommentIdParamSchema,
  todoCommentLikeResponseSchema,
  todoCommentMutationResponseSchema,
  todoCommentOverviewResponseSchema,
  todoConversationResponseSchema,
  todoDetailsParamSchema,
  todoDetailsResponseSchema,
  updateTodoCommentSchema,
} from "@aido/api/contracts/todo-comment";
import type { z } from "zod";

export const TodoDetailsParamDto = todoDetailsParamSchema.meta({
  id: "TodoDetailsParamDto",
  apiParameter: true,
});
export type TodoDetailsParamDto = z.infer<typeof TodoDetailsParamDto>;
export const TodoCommentIdParamDto = todoCommentIdParamSchema.meta({
  id: "TodoCommentIdParamDto",
  apiParameter: true,
});
export type TodoCommentIdParamDto = z.infer<typeof TodoCommentIdParamDto>;
export const WriteTodoCommentChainDto = createTodoCommentChainSchema.meta({
  id: "WriteTodoCommentChainDto",
});
export type WriteTodoCommentChainDto = z.infer<typeof WriteTodoCommentChainDto>;
export const UpdateTodoCommentDto = updateTodoCommentSchema.meta({ id: "UpdateTodoCommentDto" });
export type UpdateTodoCommentDto = z.infer<typeof UpdateTodoCommentDto>;
export const GetTodoCommentOverviewQueryDto = getTodoCommentOverviewQuerySchema.meta({
  id: "GetTodoCommentOverviewQueryDto",
  apiParameter: true,
});
export type GetTodoCommentOverviewQueryDto = z.infer<typeof GetTodoCommentOverviewQueryDto>;
export const GetTodoConversationQueryDto = getTodoConversationQuerySchema.meta({
  id: "GetTodoConversationQueryDto",
  apiParameter: true,
});
export type GetTodoConversationQueryDto = z.infer<typeof GetTodoConversationQueryDto>;

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
