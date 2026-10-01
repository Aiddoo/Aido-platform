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
import type { z } from "zod";

export const TodoCategoryDto = todoCategorySchema.meta({ id: "TodoCategoryDto" });
export type TodoCategoryDto = z.infer<typeof TodoCategoryDto>;
export const TodoCategoryWithCountDto = todoCategoryWithCountSchema.meta({
	id: "TodoCategoryWithCountDto",
});
export type TodoCategoryWithCountDto = z.infer<typeof TodoCategoryWithCountDto>;
export const TodoCategoryListResponseDto = todoCategoryListResponseSchema.meta({
	id: "TodoCategoryListResponseDto",
});
export type TodoCategoryListResponseDto = z.infer<typeof TodoCategoryListResponseDto>;
export const TodoCategoryResponseDto = todoCategoryResponseSchema.meta({
	id: "TodoCategoryResponseDto",
});
export type TodoCategoryResponseDto = z.infer<typeof TodoCategoryResponseDto>;
export const CreateTodoCategoryResponseDto = createTodoCategoryResponseSchema.meta({
	id: "CreateTodoCategoryResponseDto",
});
export type CreateTodoCategoryResponseDto = z.infer<typeof CreateTodoCategoryResponseDto>;
export const UpdateTodoCategoryResponseDto = updateTodoCategoryResponseSchema.meta({
	id: "UpdateTodoCategoryResponseDto",
});
export type UpdateTodoCategoryResponseDto = z.infer<typeof UpdateTodoCategoryResponseDto>;
export const DeleteTodoCategoryResponseDto = deleteTodoCategoryResponseSchema.meta({
	id: "DeleteTodoCategoryResponseDto",
});
export type DeleteTodoCategoryResponseDto = z.infer<typeof DeleteTodoCategoryResponseDto>;
export const ReorderTodoCategoryResponseDto = reorderTodoCategoryResponseSchema.meta({
	id: "ReorderTodoCategoryResponseDto",
});
export type ReorderTodoCategoryResponseDto = z.infer<typeof ReorderTodoCategoryResponseDto>;
