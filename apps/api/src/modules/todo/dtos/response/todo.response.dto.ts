/**
 * Todo 응답 DTO
 */

import {
	createTodoResponseSchema,
	deleteTodoResponseSchema,
	reorderTodoResponseSchema,
	todoListResponseSchema,
	todoSchema,
	updateTodoResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/** 단일 Todo 응답 */
export class TodoResponseDto extends createZodDto(todoSchema) {}

/** Todo 목록 응답 (페이지네이션 포함) */
export class TodoListResponseDto extends createZodDto(todoListResponseSchema) {}

/** Todo 생성 응답 */
export class CreateTodoResponseDto extends createZodDto(
	createTodoResponseSchema,
) {}

/** Todo 수정 응답 */
export class UpdateTodoResponseDto extends createZodDto(
	updateTodoResponseSchema,
) {}

/** Todo 삭제 응답 */
export class DeleteTodoResponseDto extends createZodDto(
	deleteTodoResponseSchema,
) {}

/** Todo 순서 변경 응답 */
export class ReorderTodoResponseDto extends createZodDto(
	reorderTodoResponseSchema,
) {}
