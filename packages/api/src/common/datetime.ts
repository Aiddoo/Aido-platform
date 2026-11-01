import { z } from "zod";

/** 순간(instant): ISO 8601 UTC. 예: 2026-01-17T10:00:00.000Z */
export const datetimeSchema = z.iso.datetime();
export const nullableDatetimeSchema = datetimeSchema.nullable();
export const optionalDatetimeSchema = datetimeSchema.optional();

/** 사용자 타임존 기준 달력 날짜. 예: 2026-01-17 */
export const dateSchema = z.iso.date();
export const nullableDateSchema = dateSchema.nullable();
export const optionalDateSchema = dateSchema.optional();

/** 사용자 타임존 기준 벽시계 시각(24시간). 예: 09:30 */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "시간 형식이 올바르지 않습니다 (HH:mm)");
