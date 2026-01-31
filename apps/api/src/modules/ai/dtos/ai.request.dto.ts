import { parseTodoRequestSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ParseTodoRequestDto extends createZodDto(parseTodoRequestSchema) {}
