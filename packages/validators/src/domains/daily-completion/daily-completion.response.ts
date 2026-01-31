import { z } from 'zod';
import { datetimeSchema } from '../../common/datetime';

export const dailyCompletionSchema = z
  .object({
    id: z.cuid().describe('데일리 달성 기록 ID (CUID 25자, 예: clz7x5p8k0040qz0z8z8z8z8z)'),
    userId: z.cuid().describe('사용자 ID (CUID 25자, 예: clz7x5p8k0001qz0z8z8z8z8z)'),
    date: z.string().describe('날짜 (YYYY-MM-DD, 예: 2026-01-17)'),
    totalTodos: z.number().int().min(0).describe('해당 날짜 전체 할 일 개수 (0 이상)'),
    completedTodos: z.number().int().min(0).describe('완료한 할 일 개수 (0 이상)'),
    achievedAt: datetimeSchema.describe(
      '100% 달성 시각 (ISO 8601 UTC, 예: 2026-01-17T18:30:00.000Z)',
    ),
    createdAt: datetimeSchema.describe(
      '기록 생성 시각 (ISO 8601 UTC, 예: 2026-01-17T09:00:00.000Z)',
    ),
    updatedAt: datetimeSchema.describe(
      '기록 수정 시각 (ISO 8601 UTC, 예: 2026-01-17T18:30:00.000Z)',
    ),
  })
  .meta({
    example: {
      id: 'clz7x5p8k0040qz0z8z8z8z8z',
      userId: 'clz7x5p8k0001qz0z8z8z8z8z',
      date: '2026-01-17',
      totalTodos: 5,
      completedTodos: 5,
      achievedAt: '2026-01-17T18:30:00.000Z',
      createdAt: '2026-01-17T09:00:00.000Z',
      updatedAt: '2026-01-17T18:30:00.000Z',
    },
  });

export type DailyCompletion = z.infer<typeof dailyCompletionSchema>;

export const dailyCompletionSummarySchema = z
  .object({
    date: z.string().describe('날짜 (YYYY-MM-DD, 예: 2026-01-17)'),
    totalTodos: z.number().int().min(0).describe('해당 날짜 전체 할 일 개수 (0 이상)'),
    completedTodos: z.number().int().min(0).describe('완료한 할 일 개수 (0 이상)'),
    isComplete: z.boolean().describe('100% 달성 여부 (completedTodos === totalTodos)'),
    completionRate: z.number().min(0).max(100).describe('완료율 (0-100%, 소수점 포함 가능)'),
  })
  .meta({
    example: {
      date: '2026-01-17',
      totalTodos: 5,
      completedTodos: 5,
      isComplete: true,
      completionRate: 100,
    },
  });

export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummarySchema>;

export const dailyCompletionsRangeResponseSchema = z
  .object({
    completions: z.array(dailyCompletionSummarySchema).describe('기간 내 일별 달성 요약 배열'),
    totalCompleteDays: z.number().int().min(0).describe('100% 달성한 날 개수 (0 이상)'),
    dateRange: z
      .object({
        startDate: z.string().describe('조회 시작 날짜 (YYYY-MM-DD, 예: 2026-01-15)'),
        endDate: z.string().describe('조회 종료 날짜 (YYYY-MM-DD, 예: 2026-01-17)'),
      })
      .describe('조회 날짜 범위'),
  })
  .meta({
    example: {
      completions: [
        {
          date: '2026-01-15',
          totalTodos: 3,
          completedTodos: 3,
          isComplete: true,
          completionRate: 100,
        },
        {
          date: '2026-01-16',
          totalTodos: 4,
          completedTodos: 2,
          isComplete: false,
          completionRate: 50,
        },
        {
          date: '2026-01-17',
          totalTodos: 5,
          completedTodos: 5,
          isComplete: true,
          completionRate: 100,
        },
      ],
      totalCompleteDays: 2,
      dateRange: {
        startDate: '2026-01-15',
        endDate: '2026-01-17',
      },
    },
  });

export type DailyCompletionsRangeResponse = z.infer<typeof dailyCompletionsRangeResponseSchema>;

export const monthlyStatsResponseSchema = z
  .object({
    year: z.number().int().describe('년도 (양의 정수, 예: 2026)'),
    month: z.number().int().min(1).max(12).describe('월 (1-12)'),
    totalCompleteDays: z.number().int().min(0).describe('해당 월 100% 달성한 날 개수 (0 이상)'),
    totalDaysWithTodos: z.number().int().min(0).describe('해당 월 할 일이 있었던 날 개수 (0 이상)'),
    averageCompletionRate: z
      .number()
      .min(0)
      .max(100)
      .describe('해당 월 평균 완료율 (0-100%, 소수점 포함 가능)'),
    longestStreak: z.number().int().min(0).describe('해당 월 최장 연속 달성 일수 (0 이상)'),
    currentStreak: z
      .number()
      .int()
      .min(0)
      .describe('해당 월 마지막 날 기준 현재 연속 달성 일수 (0 이상)'),
  })
  .meta({
    example: {
      year: 2026,
      month: 1,
      totalCompleteDays: 12,
      totalDaysWithTodos: 17,
      averageCompletionRate: 78.5,
      longestStreak: 5,
      currentStreak: 3,
    },
  });

export type MonthlyStatsResponse = z.infer<typeof monthlyStatsResponseSchema>;
