import {
	convertMemoToTodoResponseSchema,
	memoDeleteResponseSchema,
	memoListResponseSchema,
	memoMutationResponseSchema,
	memoResourceLimitResponseSchema,
	memoSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class MemoResponseDto extends createZodDto(memoSchema) {}
export class MemoMutationResponseDto extends createZodDto(
	memoMutationResponseSchema,
) {}
export class MemoDeleteResponseDto extends createZodDto(
	memoDeleteResponseSchema,
) {}
export class MemoListResponseDto extends createZodDto(memoListResponseSchema) {}
export class ConvertMemoToTodoResponseDto extends createZodDto(
	convertMemoToTodoResponseSchema,
) {}
export class MemoResourceLimitResponseDto extends createZodDto(
	memoResourceLimitResponseSchema,
) {}
