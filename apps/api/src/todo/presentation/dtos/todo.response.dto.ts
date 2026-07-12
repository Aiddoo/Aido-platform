import {
	createRecurringTodoResponseSchema,
	createTodoResponseSchema,
	deleteTodoResponseSchema,
	reorderTodoResponseSchema,
	todoListResponseSchema,
	todoResourceLimitResponseSchema,
	todoSchema,
	todoSummaryResponseSchema,
	updateTodoResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoResponseDto extends createZodDto(todoSchema) {}
export class TodoListResponseDto extends createZodDto(todoListResponseSchema) {}
export class CreateTodoResponseDto extends createZodDto(
	createTodoResponseSchema,
) {}
export class CreateRecurringTodoResponseDto extends createZodDto(
	createRecurringTodoResponseSchema,
) {}
export class UpdateTodoResponseDto extends createZodDto(
	updateTodoResponseSchema,
) {}
export class DeleteTodoResponseDto extends createZodDto(
	deleteTodoResponseSchema,
) {}
export class ReorderTodoResponseDto extends createZodDto(
	reorderTodoResponseSchema,
) {}
export class TodoResourceLimitResponseDto extends createZodDto(
	todoResourceLimitResponseSchema,
) {}
export class TodoSummaryResponseDto extends createZodDto(
	todoSummaryResponseSchema,
) {}
