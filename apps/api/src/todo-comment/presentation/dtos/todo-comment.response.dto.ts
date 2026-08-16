import {
	deleteTodoCommentResponseSchema,
	todoCommentLikeResponseSchema,
	todoCommentChainResponseSchema,
	todoCommentMutationResponseSchema,
	todoCommentThreadResponseSchema,
	paginatedTodoCommentsSchema,
	todoDetailsResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoDetailsResponseDto extends createZodDto(todoDetailsResponseSchema) {}
export class PaginatedTodoCommentsResponseDto extends createZodDto(paginatedTodoCommentsSchema) {}
export class TodoCommentChainResponseDto extends createZodDto(todoCommentChainResponseSchema) {}
export class TodoCommentMutationResponseDto extends createZodDto(
	todoCommentMutationResponseSchema,
) {}
export class TodoCommentLikeResponseDto extends createZodDto(todoCommentLikeResponseSchema) {}
export class DeleteTodoCommentResponseDto extends createZodDto(deleteTodoCommentResponseSchema) {}
export class TodoCommentThreadResponseDto extends createZodDto(todoCommentThreadResponseSchema) {}
