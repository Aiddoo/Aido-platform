/**
 * 카테고리 생성 요청 DTO
 */

import { createTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateTodoCategoryDto extends createZodDto(
	createTodoCategorySchema,
) {}
