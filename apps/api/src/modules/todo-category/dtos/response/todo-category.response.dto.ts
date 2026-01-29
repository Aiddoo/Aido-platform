/**
 * TodoCategory 응답 DTO
 */

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

/** 단일 카테고리 응답 */
export class TodoCategoryDto extends createZodDto(todoCategorySchema) {}

/** 카테고리 (Todo 개수 포함) */
export class TodoCategoryWithCountDto extends createZodDto(
	todoCategoryWithCountSchema,
) {}

/** 카테고리 목록 응답 */
export class TodoCategoryListResponseDto extends createZodDto(
	todoCategoryListResponseSchema,
) {}

/** 카테고리 상세 응답 */
export class TodoCategoryResponseDto extends createZodDto(
	todoCategoryResponseSchema,
) {}

/** 카테고리 생성 응답 */
export class CreateTodoCategoryResponseDto extends createZodDto(
	createTodoCategoryResponseSchema,
) {}

/** 카테고리 수정 응답 */
export class UpdateTodoCategoryResponseDto extends createZodDto(
	updateTodoCategoryResponseSchema,
) {}

/** 카테고리 삭제 응답 */
export class DeleteTodoCategoryResponseDto extends createZodDto(
	deleteTodoCategoryResponseSchema,
) {}

/** 카테고리 순서 변경 응답 */
export class ReorderTodoCategoryResponseDto extends createZodDto(
	reorderTodoCategoryResponseSchema,
) {}
