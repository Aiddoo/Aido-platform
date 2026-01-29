import { changeTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 할 일 카테고리 변경 요청 DTO
 */
export class ChangeTodoCategoryDto extends createZodDto(
	changeTodoCategorySchema,
) {}
