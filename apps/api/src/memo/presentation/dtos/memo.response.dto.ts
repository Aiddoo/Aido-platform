import {
	convertMemoToTodoResponseSchema,
	convertMemoToTodosResponseSchema,
	memoDeleteResponseSchema,
	memoDetailResponseSchema,
	memoListResponseSchema,
	memoMutationResponseSchema,
	memoResourceLimitResponseSchema,
	memoSchema,
} from "@aido/validators";
import type { z } from "zod";

export const MemoResponseDto = memoSchema.meta({ id: "MemoResponseDto" });
export type MemoResponseDto = z.infer<typeof MemoResponseDto>;
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
