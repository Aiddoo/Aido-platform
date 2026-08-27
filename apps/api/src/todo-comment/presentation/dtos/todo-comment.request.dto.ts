import {
	createTodoCommentChainSchema,
	getTodoCommentOverviewQuerySchema,
	getTodoConversationQuerySchema,
	todoCommentIdParamSchema,
	todoDetailsParamSchema,
	updateTodoCommentSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoDetailsParamDto extends createZodDto(todoDetailsParamSchema) {}
export class TodoCommentIdParamDto extends createZodDto(todoCommentIdParamSchema) {}
export class WriteTodoCommentChainDto extends createZodDto(createTodoCommentChainSchema) {}
export class UpdateTodoCommentDto extends createZodDto(updateTodoCommentSchema) {}
export class GetTodoCommentOverviewQueryDto extends createZodDto(
	getTodoCommentOverviewQuerySchema,
) {}
export class GetTodoConversationQueryDto extends createZodDto(getTodoConversationQuerySchema) {}
