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
import { createZodDto } from "nestjs-zod";

export class MemoResponseDto extends createZodDto(memoSchema) {}
export class MemoDetailResponseDto extends createZodDto(memoDetailResponseSchema) {}
export class MemoMutationResponseDto extends createZodDto(memoMutationResponseSchema) {}
export class MemoDeleteResponseDto extends createZodDto(memoDeleteResponseSchema) {}
export class MemoListResponseDto extends createZodDto(memoListResponseSchema) {}
export class ConvertMemoToTodoResponseDto extends createZodDto(convertMemoToTodoResponseSchema) {}
export class ConvertMemoToTodosResponseDto extends createZodDto(convertMemoToTodosResponseSchema) {}
export class MemoResourceLimitResponseDto extends createZodDto(memoResourceLimitResponseSchema) {}
