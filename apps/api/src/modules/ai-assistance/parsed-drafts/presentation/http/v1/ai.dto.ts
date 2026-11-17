import {
  aiUsageResponseSchema,
  parseMemoRequestSchema,
  parseMemoResponseSchema,
  parseTodoRequestSchema,
  parseTodoResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const ParseTodoRequestDto = parseTodoRequestSchema.meta({ id: "ParseTodoRequestDto" });
export type ParseTodoRequestDto = z.infer<typeof ParseTodoRequestDto>;
export const ParseMemoRequestDto = parseMemoRequestSchema.meta({ id: "ParseMemoRequestDto" });
export type ParseMemoRequestDto = z.infer<typeof ParseMemoRequestDto>;
export const ParseTodoResponseDto = parseTodoResponseSchema.meta({ id: "ParseTodoResponseDto" });
export type ParseTodoResponseDto = z.infer<typeof ParseTodoResponseDto>;
export const ParseMemoResponseDto = parseMemoResponseSchema.meta({ id: "ParseMemoResponseDto" });
export type ParseMemoResponseDto = z.infer<typeof ParseMemoResponseDto>;
export const AiUsageResponseDto = aiUsageResponseSchema.meta({ id: "AiUsageResponseDto" });
export type AiUsageResponseDto = z.infer<typeof AiUsageResponseDto>;
