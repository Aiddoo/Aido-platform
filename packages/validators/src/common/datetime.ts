// Known Issue: Zod v4 z.date()는 JSON Schema 변환 불가
// - https://github.com/colinhacks/zod/issues/4508
// - https://github.com/colinhacks/zod/issues/3786
// Solution: z.iso.datetime() 사용 후 transform으로 Date 객체 변환 (Zod v4 권장 API)
import { z } from 'zod';

// ============================================================================
// Input 스키마 (Request DTO용)
// - String → Date 변환 (transform)
// - API 요청 시 클라이언트에서 ISO 8601 문자열 전송 → 서버에서 Date 객체로 변환
// ============================================================================
export const datetimeInputSchema = z.iso.datetime().transform((date) => new Date(date));
export const nullableDatetimeInputSchema = datetimeInputSchema.nullable();
export const optionalDatetimeInputSchema = datetimeInputSchema.optional();

// ============================================================================
// Output 스키마 (Response DTO용)
// - String 그대로 유지 (transform 없음)
// - 서버에서 Date 객체 → JSON 직렬화 시 ISO 8601 문자열로 변환됨
// - nestjs-zod 유효성 검사 시 타입 일치 보장
// ============================================================================
export const datetimeOutputSchema = z.iso.datetime();
export const nullableDatetimeOutputSchema = datetimeOutputSchema.nullable();
export const optionalDatetimeOutputSchema = datetimeOutputSchema.optional();

// ============================================================================
// 하위 호환성을 위한 alias (기존 코드 호환)
// - 신규 코드에서는 명시적으로 Input/Output 스키마 사용 권장
// ============================================================================
export const datetimeSchema = datetimeInputSchema;
export const nullableDatetimeSchema = nullableDatetimeInputSchema;
export const optionalDatetimeSchema = optionalDatetimeInputSchema;

// Request DTO용 alias
export const dateInputSchema = datetimeInputSchema;
export const nullableDateInputSchema = nullableDatetimeInputSchema;
export const optionalDateInputSchema = optionalDatetimeInputSchema;
