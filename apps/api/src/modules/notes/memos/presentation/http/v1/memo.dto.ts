import {
  convertMemoToTodoResponseSchema,
  convertMemoToTodoSchema,
  convertMemoToTodosResponseSchema,
  convertMemoToTodosSchema,
  createMemoSchema,
  getMemosQuerySchema,
  memoDeleteResponseSchema,
  memoDetailResponseSchema,
  memoIdParamSchema,
  memoListResponseSchema,
  memoMutationResponseSchema,
  memoResourceLimitResponseSchema,
  reorderMemoSchema,
  toggleMemoPinSchema,
  updateMemoSchema,
} from "@aido/api/contracts/memo";
import type { z } from "zod";

export const CreateMemoDto = createMemoSchema.meta({ id: "CreateMemoDto" });
export type CreateMemoDto = z.infer<typeof CreateMemoDto>;
export const UpdateMemoDto = updateMemoSchema.meta({ id: "UpdateMemoDto" });
export type UpdateMemoDto = z.infer<typeof UpdateMemoDto>;
export const ToggleMemoPinDto = toggleMemoPinSchema.meta({ id: "ToggleMemoPinDto" });
export type ToggleMemoPinDto = z.infer<typeof ToggleMemoPinDto>;
export const ReorderMemoDto = reorderMemoSchema.meta({ id: "ReorderMemoDto" });
export type ReorderMemoDto = z.infer<typeof ReorderMemoDto>;
export const ConvertMemoToTodoDto = convertMemoToTodoSchema.meta({ id: "ConvertMemoToTodoDto" });
export type ConvertMemoToTodoDto = z.infer<typeof ConvertMemoToTodoDto>;
export const ConvertMemoToTodosDto = convertMemoToTodosSchema.meta({ id: "ConvertMemoToTodosDto" });
export type ConvertMemoToTodosDto = z.infer<typeof ConvertMemoToTodosDto>;
export const GetMemosQueryDto = getMemosQuerySchema.meta({
  id: "GetMemosQueryDto",
  apiParameter: true,
});
export type GetMemosQueryDto = z.infer<typeof GetMemosQueryDto>;
export const MemoIdParamDto = memoIdParamSchema.meta({ id: "MemoIdParamDto", apiParameter: true });
export type MemoIdParamDto = z.infer<typeof MemoIdParamDto>;

export const MemoDetailResponseDto = memoDetailResponseSchema.meta({ id: "MemoDetailResponseDto" });
export type MemoDetailResponseDto = z.infer<typeof MemoDetailResponseDto>;
export const MemoMutationResponseDto = memoMutationResponseSchema.meta({
  id: "MemoMutationResponseDto",
});
export type MemoMutationResponseDto = z.infer<typeof MemoMutationResponseDto>;
export const MemoDeleteResponseDto = memoDeleteResponseSchema.meta({ id: "MemoDeleteResponseDto" });
export type MemoDeleteResponseDto = z.infer<typeof MemoDeleteResponseDto>;
export const MemoListResponseDto = memoListResponseSchema.meta({ id: "MemoListResponseDto" });
export type MemoListResponseDto = z.infer<typeof MemoListResponseDto>;
export const ConvertMemoToTodoResponseDto = convertMemoToTodoResponseSchema.meta({
  id: "ConvertMemoToTodoResponseDto",
});
export type ConvertMemoToTodoResponseDto = z.infer<typeof ConvertMemoToTodoResponseDto>;
export const ConvertMemoToTodosResponseDto = convertMemoToTodosResponseSchema.meta({
  id: "ConvertMemoToTodosResponseDto",
});
export type ConvertMemoToTodosResponseDto = z.infer<typeof ConvertMemoToTodosResponseDto>;
export const MemoResourceLimitResponseDto = memoResourceLimitResponseSchema.meta({
  id: "MemoResourceLimitResponseDto",
});
export type MemoResourceLimitResponseDto = z.infer<typeof MemoResourceLimitResponseDto>;
