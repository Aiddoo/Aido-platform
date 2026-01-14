/**
 * DateTime Zod 스키마 유틸리티
 *
 * Known Issue: Zod v4 z.date()는 JSON Schema 변환 불가
 * - https://github.com/colinhacks/zod/issues/4508
 * - https://github.com/colinhacks/zod/issues/3786
 *
 * Solution: z.string().datetime() 사용 후 transform으로 자동 변환
 * - 입력: ISO 8601 문자열
 * - 출력: Date 객체 (Service 계층에서의 편리함 + Prisma 호환성)
 */
import { z } from 'zod';

/**
 * ISO 8601 datetime 스키마
 * 입력은 String으로 검증하고, 출력은 Date 객체로 자동 변환합니다.
 */
export const datetimeSchema = z
  .string()
  .datetime({ offset: true })
  .transform((date) => new Date(date));

export const nullableDatetimeSchema = datetimeSchema.nullable();
export const optionalDatetimeSchema = datetimeSchema.optional();

/** DTO용 alias */
export const dateInputSchema = datetimeSchema;
export const nullableDateInputSchema = nullableDatetimeSchema;
export const optionalDateInputSchema = optionalDatetimeSchema;
