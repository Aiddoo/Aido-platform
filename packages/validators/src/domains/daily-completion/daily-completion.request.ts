import { z } from 'zod';

export const getDailyCompletionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
    .describe('조회할 날짜 (YYYY-MM-DD, 예: 2026-01-17)'),
});

export type GetDailyCompletionInput = z.infer<typeof getDailyCompletionSchema>;

export const getDailyCompletionsRangeSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('시작 날짜 (YYYY-MM-DD, 예: 2026-01-01)'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('종료 날짜 (YYYY-MM-DD, 예: 2026-01-31)'),
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    '시작 날짜는 종료 날짜보다 이전이어야 합니다',
  );

export type GetDailyCompletionsRangeInput = z.infer<typeof getDailyCompletionsRangeSchema>;

export const getUserDailyCompletionsSchema = z
  .object({
    userId: z
      .cuid('유효하지 않은 사용자 ID입니다')
      .describe('사용자 ID (CUID 25자, 예: clz7x5p8k0001qz0z8z8z8z8z)'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('시작 날짜 (YYYY-MM-DD, 예: 2026-01-01)'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다')
      .describe('종료 날짜 (YYYY-MM-DD, 예: 2026-01-31)'),
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    '시작 날짜는 종료 날짜보다 이전이어야 합니다',
  );

export type GetUserDailyCompletionsInput = z.infer<typeof getUserDailyCompletionsSchema>;
