import { z } from 'zod';

/**
 * 특정 날짜의 완료 정보 조회 요청
 */
export const getDailyCompletionSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('조회할 날짜 (YYYY-MM-DD)'),
  })
  .describe('특정 날짜의 완료 정보 조회');

export type GetDailyCompletionInput = z.infer<typeof getDailyCompletionSchema>;

/**
 * 날짜 범위로 완료 정보 조회 요청 (캘린더용)
 */
export const getDailyCompletionsRangeSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('종료 날짜 (YYYY-MM-DD)'),
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    '시작 날짜는 종료 날짜보다 이전이어야 합니다',
  )
  .describe('날짜 범위로 완료 정보 조회 (캘린더용)');

export type GetDailyCompletionsRangeInput = z.infer<typeof getDailyCompletionsRangeSchema>;

/**
 * 특정 사용자의 완료 정보 조회 (팔로잉 캘린더용)
 */
export const getUserDailyCompletionsSchema = z
  .object({
    userId: z.string().cuid('유효하지 않은 사용자 ID입니다').describe('조회할 사용자 ID'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('종료 날짜 (YYYY-MM-DD)'),
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    '시작 날짜는 종료 날짜보다 이전이어야 합니다',
  )
  .describe('특정 사용자의 완료 정보 조회');

export type GetUserDailyCompletionsInput = z.infer<typeof getUserDailyCompletionsSchema>;
