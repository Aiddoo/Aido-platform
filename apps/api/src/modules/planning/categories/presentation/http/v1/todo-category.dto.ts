import {
  createTodoCategoryResponseSchema,
  createTodoCategorySchema,
  deleteTodoCategoryQuerySchema,
  deleteTodoCategoryResponseSchema,
  reorderTodoCategoryResponseSchema,
  reorderTodoCategorySchema,
  todoCategoryDeletionPreviewSchema,
  todoCategoryIdParamSchema,
  todoCategoryListResponseSchema,
  todoCategoryResponseSchema,
  updateTodoCategoryResponseSchema,
  updateTodoCategorySchema,
} from "@aido/api";
import { ApiProperty } from "@nestjs/swagger";
import type { z } from "zod";

export const CreateTodoCategoryDto = createTodoCategorySchema.meta({ id: "CreateTodoCategoryDto" });
export type CreateTodoCategoryDto = z.infer<typeof CreateTodoCategoryDto>;

export const DeleteTodoCategoryQueryDto = deleteTodoCategoryQuerySchema.meta({
  id: "DeleteTodoCategoryQueryDto",
  apiParameter: true,
});
export type DeleteTodoCategoryQueryDto = z.infer<typeof DeleteTodoCategoryQueryDto>;

export const ReorderTodoCategoryDto = reorderTodoCategorySchema.meta({
  id: "ReorderTodoCategoryDto",
});
export type ReorderTodoCategoryDto = z.infer<typeof ReorderTodoCategoryDto>;

export const TodoCategoryIdParamDto = todoCategoryIdParamSchema.meta({
  id: "TodoCategoryIdParamDto",
  apiParameter: true,
});
export type TodoCategoryIdParamDto = z.infer<typeof TodoCategoryIdParamDto>;

export const UpdateTodoCategoryDto = updateTodoCategorySchema.meta({ id: "UpdateTodoCategoryDto" });
export type UpdateTodoCategoryDto = z.infer<typeof UpdateTodoCategoryDto>;

export class TodoCategoryResourceLimitResponseDto {
  @ApiProperty({ description: "현재 카테고리 개수", example: 3 })
  declare categoryCount: number;

  @ApiProperty({
    description: "최대 한도 (null이면 무제한)",
    example: 10,
    nullable: true,
    type: Number,
  })
  declare maxCount: number | null;
}

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
export const TodoCategoryDeletionPreviewDto = todoCategoryDeletionPreviewSchema.meta({
  id: "TodoCategoryDeletionPreviewDto",
});
export type TodoCategoryDeletionPreviewDto = z.infer<typeof TodoCategoryDeletionPreviewDto>;
export const ReorderTodoCategoryResponseDto = reorderTodoCategoryResponseSchema.meta({
  id: "ReorderTodoCategoryResponseDto",
});
export type ReorderTodoCategoryResponseDto = z.infer<typeof ReorderTodoCategoryResponseDto>;
