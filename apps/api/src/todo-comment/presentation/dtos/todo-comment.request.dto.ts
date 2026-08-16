import {
	createTodoCommentChainSchema,
	getTodoCommentsQuerySchema,
	todoCommentIdParamSchema,
	todoDetailsParamSchema,
	updateTodoCommentSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoDetailsParamDto extends createZodDto(todoDetailsParamSchema) {}
export class TodoCommentIdParamDto extends createZodDto(todoCommentIdParamSchema) {}
export class WriteTodoCommentChainDto extends createZodDto(createTodoCommentChainSchema) {}
export class UpdateTodoCommentDto extends createZodDto(updateTodoCommentSchema) {}
export class GetTodoCommentsQueryDto extends createZodDto(getTodoCommentsQuerySchema) {}
