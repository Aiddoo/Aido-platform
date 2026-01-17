/**
 * 완료 상태 토글 요청 DTO
 */

import { toggleTodoCompleteSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ToggleTodoCompleteDto extends createZodDto(
	toggleTodoCompleteSchema,
) {}
