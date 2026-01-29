/**
 * 카테고리 순서 변경 요청 DTO
 */

import { reorderTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ReorderTodoCategoryDto extends createZodDto(
	reorderTodoCategorySchema,
) {}
