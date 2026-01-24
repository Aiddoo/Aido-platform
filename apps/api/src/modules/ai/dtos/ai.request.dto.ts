/**
 * AI Request DTOs (NestJS)
 *
 * nestjs-zod의 createZodDto를 사용한 NestJS DTO 클래스
 */

import { parseTodoRequestSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/** AI 자연어 투두 파싱 요청 DTO */
export class ParseTodoRequestDto extends createZodDto(parseTodoRequestSchema) {}
