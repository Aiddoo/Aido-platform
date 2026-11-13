import { z } from 'zod';

/** 날짜 하나를 담은 키 끝 조각(날짜 목록·위젯 요약) */
export const todoDateQueryKeySchema = z.object({ date: z.string() });

/** 기간을 담은 키 끝 조각(달력 완료 범위) */
export const todoRangeQueryKeySchema = z.object({ startDate: z.string(), endDate: z.string() });
