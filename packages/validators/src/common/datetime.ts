// Known Issue: Zod v4 z.date()는 JSON Schema 변환 불가
// - https://github.com/colinhacks/zod/issues/4508
// - https://github.com/colinhacks/zod/issues/3786
// Solution: z.iso.datetime() / z.iso.date() 사용 (Zod v4 권장 API)
import { z } from 'zod';

// ============================================================================
// DateTime 스키마
// - ISO 8601 datetime 문자열 (예: 2026-01-17T10:00:00.000Z)
// - JSON 직렬화 시 타입 일치 보장
// ============================================================================
export const datetimeSchema = z.iso.datetime();
export const nullableDatetimeSchema = datetimeSchema.nullable();
export const optionalDatetimeSchema = datetimeSchema.optional();

// ============================================================================
// Date 스키마 (날짜만, 시간 제외)
// - YYYY-MM-DD 형식 (예: 2026-01-17)
// - Prisma @db.Date 필드용
// ============================================================================
export const dateSchema = z.iso.date();
export const nullableDateSchema = dateSchema.nullable();
export const optionalDateSchema = dateSchema.optional();
