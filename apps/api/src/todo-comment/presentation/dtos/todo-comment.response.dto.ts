import {
	deleteTodoCommentResponseSchema,
	todoCommentChainResponseSchema,
	todoCommentLikeResponseSchema,
	todoCommentMutationResponseSchema,
	todoCommentOverviewResponseSchema,
	todoConversationResponseSchema,
	todoDetailsResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoDetailsResponseDto extends createZodDto(todoDetailsResponseSchema) {}
export class TodoCommentOverviewResponseDto extends createZodDto(
	todoCommentOverviewResponseSchema,
) {}
export class TodoConversationResponseDto extends createZodDto(todoConversationResponseSchema) {}
export class TodoCommentChainResponseDto extends createZodDto(todoCommentChainResponseSchema) {}
export class TodoCommentMutationResponseDto extends createZodDto(
	todoCommentMutationResponseSchema,
) {}
export class TodoCommentLikeResponseDto extends createZodDto(todoCommentLikeResponseSchema) {}
export class DeleteTodoCommentResponseDto extends createZodDto(deleteTodoCommentResponseSchema) {}
