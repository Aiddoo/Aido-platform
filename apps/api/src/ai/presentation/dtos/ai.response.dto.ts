import {
  aiUsageDataSchema,
  aiUsageResponseSchema,
  parsedMemoDataSchema,
  parsedTodoDataSchema,
  parseMemoResponseSchema,
  parseTodoMetaSchema,
  parseTodoResponseSchema,
} from "@aido/validators";
import type { z } from "zod";

export const ParsedTodoDataDto = parsedTodoDataSchema.meta({ id: "ParsedTodoDataDto" });
export type ParsedTodoDataDto = z.infer<typeof ParsedTodoDataDto>;
export const ParseTodoMetaDto = parseTodoMetaSchema.meta({ id: "ParseTodoMetaDto" });
export type ParseTodoMetaDto = z.infer<typeof ParseTodoMetaDto>;
export const ParseTodoResponseDto = parseTodoResponseSchema.meta({ id: "ParseTodoResponseDto" });
export type ParseTodoResponseDto = z.infer<typeof ParseTodoResponseDto>;
export const ParsedMemoDataDto = parsedMemoDataSchema.meta({ id: "ParsedMemoDataDto" });
export type ParsedMemoDataDto = z.infer<typeof ParsedMemoDataDto>;
export const ParseMemoResponseDto = parseMemoResponseSchema.meta({ id: "ParseMemoResponseDto" });
export type ParseMemoResponseDto = z.infer<typeof ParseMemoResponseDto>;
export const AiUsageDataDto = aiUsageDataSchema.meta({ id: "AiUsageDataDto" });
export type AiUsageDataDto = z.infer<typeof AiUsageDataDto>;
export const AiUsageResponseDto = aiUsageResponseSchema.meta({ id: "AiUsageResponseDto" });
export type AiUsageResponseDto = z.infer<typeof AiUsageResponseDto>;
