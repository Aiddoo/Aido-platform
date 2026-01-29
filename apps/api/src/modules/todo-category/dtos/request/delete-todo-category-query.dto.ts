/**
 * 카테고리 삭제 쿼리 DTO
 */

import { deleteTodoCategoryQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class DeleteTodoCategoryQueryDto extends createZodDto(
	deleteTodoCategoryQuerySchema,
) {}
