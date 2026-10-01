import { parseMemoRequestSchema, parseTodoRequestSchema } from "@aido/validators";
import type { z } from "zod";

export const ParseTodoRequestDto = parseTodoRequestSchema.meta({ id: "ParseTodoRequestDto" });
export type ParseTodoRequestDto = z.infer<typeof ParseTodoRequestDto>;
export const ParseMemoRequestDto = parseMemoRequestSchema.meta({ id: "ParseMemoRequestDto" });
export type ParseMemoRequestDto = z.infer<typeof ParseMemoRequestDto>;
