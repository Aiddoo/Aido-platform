/**
 * 공개 범위 변경 요청 DTO
 */

import { updateTodoVisibilitySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoVisibilityDto extends createZodDto(
	updateTodoVisibilitySchema,
) {}
