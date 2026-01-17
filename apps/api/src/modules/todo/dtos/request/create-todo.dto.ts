/**
 * Todo 생성 요청 DTO
 */

import { createTodoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateTodoDto extends createZodDto(createTodoSchema) {}
