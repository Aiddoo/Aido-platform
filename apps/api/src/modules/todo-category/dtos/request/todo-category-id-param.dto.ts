/**
 * 카테고리 ID 파라미터 DTO
 */

import { todoCategoryIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoCategoryIdParamDto extends createZodDto(
	todoCategoryIdParamSchema,
) {}
