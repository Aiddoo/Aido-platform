/**
 * 제목/내용 수정 요청 DTO
 */

import { updateTodoContentSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoContentDto extends createZodDto(
	updateTodoContentSchema,
) {}
