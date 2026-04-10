import {
	parseMemoRequestSchema,
	parseTodoRequestSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ParseTodoRequestDto extends createZodDto(parseTodoRequestSchema) {}
export class ParseMemoRequestDto extends createZodDto(parseMemoRequestSchema) {}
