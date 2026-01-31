import {
	createTodoCategoryResponseSchema,
	deleteTodoCategoryResponseSchema,
	reorderTodoCategoryResponseSchema,
	todoCategoryListResponseSchema,
	todoCategoryResponseSchema,
	todoCategorySchema,
	todoCategoryWithCountSchema,
	updateTodoCategoryResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoCategoryDto extends createZodDto(todoCategorySchema) {}
export class TodoCategoryWithCountDto extends createZodDto(
	todoCategoryWithCountSchema,
) {}
export class TodoCategoryListResponseDto extends createZodDto(
	todoCategoryListResponseSchema,
) {}
export class TodoCategoryResponseDto extends createZodDto(
	todoCategoryResponseSchema,
) {}
export class CreateTodoCategoryResponseDto extends createZodDto(
	createTodoCategoryResponseSchema,
) {}
export class UpdateTodoCategoryResponseDto extends createZodDto(
	updateTodoCategoryResponseSchema,
) {}
export class DeleteTodoCategoryResponseDto extends createZodDto(
	deleteTodoCategoryResponseSchema,
) {}
export class ReorderTodoCategoryResponseDto extends createZodDto(
	reorderTodoCategoryResponseSchema,
) {}
