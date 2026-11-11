import { z } from "zod";

import { datetimeSchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import { CATEGORY_TODO_HANDLING_RESULTS } from "../../../vocabulary/todo-category.types.js";

export const todoCategorySchema = z
  .object({
    id: z.number().int().describe("카테고리 ID (양의 정수)"),
    userId: entityIdSchema.describe("사용자 ID"),
    name: z.string().describe("카테고리 이름 (최대 50자)"),
    color: z.string().describe("카테고리 색상 (HEX 7자, 예: #FFB3B3)"),
    sortOrder: z.number().int().describe("정렬 순서 (작을수록 위)"),
    createdAt: datetimeSchema.describe("생성 시각 (ISO 8601 UTC, 예: 2026-01-29T10:00:00.000Z)"),
    updatedAt: datetimeSchema.describe("수정 시각 (ISO 8601 UTC, 예: 2026-01-29T10:00:00.000Z)"),
  })
  .meta({
    example: {
      id: 1,
      userId: "clz7x5p8k0010qz0z8z8z8z8z",
      name: "중요한 일",
      color: "#FFB3B3",
      sortOrder: 0,
      createdAt: "2026-01-29T10:00:00.000Z",
      updatedAt: "2026-01-29T10:00:00.000Z",
    },
  });

export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoCategorySummarySchema = z.object({
  id: z.number().int().describe("카테고리 ID (양의 정수)"),
  name: z.string().describe("카테고리 이름"),
  color: z.string().describe("카테고리 색상 (HEX 7자)"),
  sortOrder: z.number().int().describe("카테고리 정렬 순서 (작을수록 위)"),
});

export type TodoCategorySummary = z.infer<typeof todoCategorySummarySchema>;

export const todoCategoryWithCountSchema = todoCategorySchema.extend({
  todoCount: z.number().int().describe("카테고리 내 할 일 개수 (음이 아닌 정수)"),
});

export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

export const todoCategoryListResponseSchema = z
  .object({
    items: z.array(todoCategoryWithCountSchema).describe("카테고리 목록 (할 일 개수 포함)"),
  })
  .meta({
    example: {
      items: [
        {
          id: 1,
          userId: "clz7x5p8k0010qz0z8z8z8z8z",
          name: "중요한 일",
          color: "#FFB3B3",
          sortOrder: 0,
          todoCount: 5,
          createdAt: "2026-01-29T10:00:00.000Z",
          updatedAt: "2026-01-29T10:00:00.000Z",
        },
        {
          id: 2,
          userId: "clz7x5p8k0010qz0z8z8z8z8z",
          name: "할 일",
          color: "#FF6B43",
          sortOrder: 1,
          todoCount: 3,
          createdAt: "2026-01-29T10:00:00.000Z",
          updatedAt: "2026-01-29T10:00:00.000Z",
        },
      ],
    },
  });

export type TodoCategoryListResponse = z.infer<typeof todoCategoryListResponseSchema>;

export const createTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
    category: todoCategorySchema,
  })
  .meta({
    example: {
      message: "카테고리가 생성되었습니다.",
      category: {
        id: 1,
        userId: "clz7x5p8k0010qz0z8z8z8z8z",
        name: "중요한 일",
        color: "#FFB3B3",
        sortOrder: 0,
        createdAt: "2026-01-29T10:00:00.000Z",
        updatedAt: "2026-01-29T10:00:00.000Z",
      },
    },
  });

export type CreateTodoCategoryResponse = z.infer<typeof createTodoCategoryResponseSchema>;

export const updateTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
    category: todoCategorySchema,
  })
  .meta({
    example: {
      message: "카테고리가 수정되었습니다.",
      category: {
        id: 1,
        userId: "clz7x5p8k0010qz0z8z8z8z8z",
        name: "중요한 일 (수정됨)",
        color: "#FF0000",
        sortOrder: 0,
        createdAt: "2026-01-29T10:00:00.000Z",
        updatedAt: "2026-01-29T11:00:00.000Z",
      },
    },
  });

export type UpdateTodoCategoryResponse = z.infer<typeof updateTodoCategoryResponseSchema>;

export const categoryDeletionResultSchema = z.object({
  todoHandling: z
    .enum(CATEGORY_TODO_HANDLING_RESULTS)
    .describe(
      "실제로 한 처리 (move: 옮김, delete: 함께 삭제, none: 옮기거나 지울 할 일·진행 중 반복이 없었음)",
    ),
  todoCount: z
    .number()
    .int()
    .min(0)
    .describe("옮기거나 함께 삭제한 할 일 수 (완료 포함, 음이 아닌 정수)"),
  seriesCount: z
    .number()
    .int()
    .min(0)
    .describe("옮기거나 함께 삭제한 진행 중 반복 규칙 수 (음이 아닌 정수)"),
  moveToCategoryId: z
    .number()
    .int()
    .nullable()
    .describe("할 일을 옮긴 카테고리 ID (옮기지 않았으면 null)"),
});

export type CategoryDeletionResult = z.infer<typeof categoryDeletionResultSchema>;

export const deleteTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
    result: categoryDeletionResultSchema
      .optional()
      .describe("삭제 결과 (1.15.1 서버부터 채운다. 출시 앱은 읽지 않는다)"),
  })
  .meta({
    example: {
      message: "카테고리가 삭제되었습니다.",
      result: { todoHandling: "move", todoCount: 3, seriesCount: 1, moveToCategoryId: 1 },
    },
  });

export type DeleteTodoCategoryResponse = z.infer<typeof deleteTodoCategoryResponseSchema>;

export const todoCategoryDeletionPreviewSchema = z
  .object({
    categoryId: z.number().int().describe("삭제하려는 카테고리 ID"),
    todoCount: z
      .number()
      .int()
      .min(0)
      .describe("카테고리 안의 할 일 수 (완료 포함, 목록의 todoCount와 같은 기준)"),
    completedTodoCount: z
      .number()
      .int()
      .min(0)
      .describe("그중 완료한 할 일 수. 함께 삭제하면 날짜별 완료 기록에서도 빠진다"),
    activeSeriesCount: z
      .number()
      .int()
      .min(0)
      .describe(
        "카테고리에 속한 진행 중 반복 규칙 수. 함께 삭제하면 앞으로의 회차도 만들지 않는다",
      ),
    isLastCategory: z
      .boolean()
      .describe("마지막 남은 카테고리인지. true면 삭제할 수 없다(TODO_CATEGORY_0854)"),
  })
  .meta({
    example: {
      categoryId: 3,
      todoCount: 12,
      completedTodoCount: 8,
      activeSeriesCount: 1,
      isLastCategory: false,
    },
  });

export type TodoCategoryDeletionPreview = z.infer<typeof todoCategoryDeletionPreviewSchema>;

export const todoCategoryResponseSchema = z.object({
  category: todoCategoryWithCountSchema,
});

export type TodoCategoryResponse = z.infer<typeof todoCategoryResponseSchema>;

export const reorderTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
    category: todoCategorySchema,
  })
  .meta({
    example: {
      message: "카테고리 순서가 변경되었습니다.",
      category: {
        id: 3,
        userId: "clz7x5p8k0010qz0z8z8z8z8z",
        name: "공부",
        color: "#4A90D9",
        sortOrder: 1,
        createdAt: "2026-01-29T10:00:00.000Z",
        updatedAt: "2026-01-29T11:00:00.000Z",
      },
    },
  });

export type ReorderTodoCategoryResponse = z.infer<typeof reorderTodoCategoryResponseSchema>;
