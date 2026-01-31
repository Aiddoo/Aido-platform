import {
	aiUsageDataSchema,
	aiUsageResponseSchema,
	parsedTodoDataSchema,
	parseTodoMetaSchema,
	parseTodoResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ParsedTodoDataDto extends createZodDto(parsedTodoDataSchema) {}
export class ParseTodoMetaDto extends createZodDto(parseTodoMetaSchema) {}
export class ParseTodoResponseDto extends createZodDto(
	parseTodoResponseSchema,
) {}
export class AiUsageDataDto extends createZodDto(aiUsageDataSchema) {}
export class AiUsageResponseDto extends createZodDto(aiUsageResponseSchema) {}
