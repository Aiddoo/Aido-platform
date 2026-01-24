/**
 * AI Response DTOs (NestJS)
 *
 * nestjs-zod의 createZodDto를 사용한 NestJS DTO 클래스
 */

import {
	aiUsageDataSchema,
	aiUsageResponseSchema,
	parsedTodoDataSchema,
	parseTodoMetaSchema,
	parseTodoResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

// ============================================
// 투두 파싱 응답 DTO
// ============================================

/** 파싱된 투두 데이터 DTO */
export class ParsedTodoDataDto extends createZodDto(parsedTodoDataSchema) {}

/** 파싱 메타데이터 DTO */
export class ParseTodoMetaDto extends createZodDto(parseTodoMetaSchema) {}

/** AI 자연어 투두 파싱 응답 DTO */
export class ParseTodoResponseDto extends createZodDto(
	parseTodoResponseSchema,
) {}

// ============================================
// AI 사용량 응답 DTO
// ============================================

/** AI 사용량 데이터 DTO */
export class AiUsageDataDto extends createZodDto(aiUsageDataSchema) {}

/** AI 사용량 조회 응답 DTO */
export class AiUsageResponseDto extends createZodDto(aiUsageResponseSchema) {}
