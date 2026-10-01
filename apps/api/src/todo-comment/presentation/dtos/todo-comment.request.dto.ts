import {
	createTodoCommentChainSchema,
	getTodoCommentOverviewQuerySchema,
	getTodoConversationQuerySchema,
	todoCommentIdParamSchema,
	todoDetailsParamSchema,
	updateTodoCommentSchema,
} from "@aido/validators";
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
