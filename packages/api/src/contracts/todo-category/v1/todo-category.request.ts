import { z } from "zod";

import { CATEGORY_TODO_HANDLINGS, hexColorRegex } from "../../../vocabulary/todo-category.types.js";
import { reorderPositionSchema } from "./todo-category.common.js";

export const createTodoCategorySchema = z.object({
  name: z
    .string()
    .min(1, "카테고리명을 입력해주세요")
    .max(50, "카테고리명은 50자 이하로 입력해주세요")
    .describe("카테고리 이름 (1-50자, 예: 중요한 일)"),
  color: z
    .string()
    .regex(hexColorRegex, "HEX 색상 코드 형식이 아닙니다 (예: #FF5733)")
    .describe("카테고리 색상 (HEX 7자, 예: #FF5733)"),
});

export type CreateTodoCategoryInput = z.infer<typeof createTodoCategorySchema>;

export const updateTodoCategorySchema = z
  .object({
    name: z
      .string()
      .min(1, "카테고리명을 입력해주세요")
      .max(50, "카테고리명은 50자 이하로 입력해주세요")
      .optional()
      .describe("카테고리 이름 (선택, 1-50자, 예: 중요한 일)"),
    color: z
      .string()
      .regex(hexColorRegex, "HEX 색상 코드 형식이 아닙니다 (예: #FF5733)")
      .optional()
      .describe("카테고리 색상 (선택, HEX 7자, 예: #FF5733)"),
  })
  .refine((data) => data.name != null || data.color != null, {
    error: "카테고리명 또는 색상 중 하나는 입력해야 합니다",
  });

export type UpdateTodoCategoryInput = z.infer<typeof updateTodoCategorySchema>;

// todoHandling을 생략하면 출시 앱(1.15.0까지)의 규칙 그대로다: 할 일이 있으면 moveToCategoryId가 필요하다
export const deleteTodoCategoryQuerySchema = z
  .object({
    moveToCategoryId: z.coerce
      .number()
      .int()
      .positive("유효하지 않은 카테고리 ID입니다")
      .optional()
      .describe("할 일을 이동할 카테고리 ID (선택, 양의 정수)"),
    todoHandling: z
      .enum(CATEGORY_TODO_HANDLINGS)
      .optional()
      .describe(
        "안의 할 일 처리 (선택). move: moveToCategoryId로 옮긴 뒤 삭제(필수), delete: 할 일·반복과 함께 삭제(moveToCategoryId 금지). 생략하면 할 일이 있을 때 moveToCategoryId가 필요하다",
      ),
  })
  .refine((query) => query.todoHandling !== "move" || query.moveToCategoryId != null, {
    error: "할 일을 옮기려면 이동할 카테고리를 지정해야 합니다",
    path: ["moveToCategoryId"],
  })
  .refine((query) => query.todoHandling !== "delete" || query.moveToCategoryId == null, {
    error: "할 일을 함께 삭제할 때는 이동할 카테고리를 지정할 수 없습니다",
    path: ["moveToCategoryId"],
  });

export type DeleteTodoCategoryQuery = z.infer<typeof deleteTodoCategoryQuerySchema>;

export const reorderTodoCategorySchema = z.object({
  targetCategoryId: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 카테고리 ID입니다")
    .optional()
    .describe("기준 카테고리 ID (선택, 양의 정수)"),
  position: reorderPositionSchema.describe("이동 위치 (BEFORE | AFTER | START | END)"),
});

export type ReorderTodoCategoryInput = z.infer<typeof reorderTodoCategorySchema>;

export const todoCategoryIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 카테고리 ID입니다")
    .describe("카테고리 ID (양의 정수, 예: 1)"),
});

export type TodoCategoryIdParam = z.infer<typeof todoCategoryIdParamSchema>;
