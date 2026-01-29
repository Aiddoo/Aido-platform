/**
 * 카테고리 수정 요청 DTO
 */

import { updateTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoCategoryDto extends createZodDto(
	updateTodoCategorySchema,
) {}
