// Known Issue: Zod v4 z.date()는 JSON Schema 변환 불가
// - https://github.com/colinhacks/zod/issues/4508
// - https://github.com/colinhacks/zod/issues/3786
// Solution: z.iso.datetime() 사용 후 transform으로 Date 객체 변환 (Zod v4 권장 API)
import { z } from 'zod';

// ISO 8601 datetime 스키마 (입력: String, 출력: Date)
export const datetimeSchema = z.iso.datetime().transform((date) => new Date(date));

export const nullableDatetimeSchema = datetimeSchema.nullable();
export const optionalDatetimeSchema = datetimeSchema.optional();

// DTO용 alias
export const dateInputSchema = datetimeSchema;
export const nullableDateInputSchema = nullableDatetimeSchema;
export const optionalDateInputSchema = optionalDatetimeSchema;
