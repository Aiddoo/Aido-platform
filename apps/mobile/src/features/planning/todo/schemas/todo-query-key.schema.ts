import { dateKeySchema } from '@src/shared/date/date-key';
import { z } from 'zod';

/** 날짜 하나를 담은 키 끝 조각(날짜 목록·위젯 요약) */
export const todoDateQueryKeySchema = z.object({ date: z.string() });

/** 달(그 달 1일)을 담은 키 끝 조각(완료 기록) */
export const todoMonthQueryKeySchema = z.object({ month: dateKeySchema });
