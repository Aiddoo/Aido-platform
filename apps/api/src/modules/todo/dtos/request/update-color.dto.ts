/**
 * 색상 변경 요청 DTO
 */

import { updateTodoColorSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoColorDto extends createZodDto(updateTodoColorSchema) {}
