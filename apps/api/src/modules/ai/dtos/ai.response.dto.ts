import {
	aiUsageDataSchema,
	aiUsageResponseSchema,
	parsedMemoDataSchema,
	parsedTodoDataSchema,
	parseMemoResponseSchema,
	parseTodoMetaSchema,
	parseTodoResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ParsedTodoDataDto extends createZodDto(parsedTodoDataSchema) {}
export class ParseTodoMetaDto extends createZodDto(parseTodoMetaSchema) {}
export class ParseTodoResponseDto extends createZodDto(
	parseTodoResponseSchema,
) {}
export class ParsedMemoDataDto extends createZodDto(parsedMemoDataSchema) {}
export class ParseMemoResponseDto extends createZodDto(
	parseMemoResponseSchema,
) {}
export class AiUsageDataDto extends createZodDto(aiUsageDataSchema) {}
export class AiUsageResponseDto extends createZodDto(aiUsageResponseSchema) {}
