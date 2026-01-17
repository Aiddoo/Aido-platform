import { z } from 'zod';
import { datetimeSchema } from '../../common/datetime';

/**
 * 일일 완료 정보 스키마
 */
export const dailyCompletionSchema = z
  .object({
    id: z.string().cuid().describe('일일 완료 고유 ID'),
    userId: z.string().cuid().describe('사용자 ID'),
    date: z.string().describe('완료 날짜 (YYYY-MM-DD)'),
    totalTodos: z.number().int().min(0).describe('해당 날짜 총 Todo 수'),
    completedTodos: z.number().int().min(0).describe('완료한 Todo 수'),
    achievedAt: datetimeSchema.describe('100% 달성 시점'),
    createdAt: datetimeSchema.describe('생성 시각'),
    updatedAt: datetimeSchema.describe('수정 시각'),
  })
  .describe('일일 완료 정보')
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

/**
 * 캘린더용 간소화된 완료 정보
 */
export const dailyCompletionSummarySchema = z
  .object({
    date: z.string().describe('완료 날짜 (YYYY-MM-DD)'),
    totalTodos: z.number().int().min(0).describe('해당 날짜 총 Todo 수'),
    completedTodos: z.number().int().min(0).describe('완료한 Todo 수'),
    isComplete: z.boolean().describe('100% 완료 여부 (물고기 표시)'),
    completionRate: z.number().min(0).max(100).describe('완료율 (%)'),
  })
  .describe('캘린더용 일일 완료 요약')
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

/**
 * 날짜 범위 완료 정보 응답
 */
export const dailyCompletionsRangeResponseSchema = z
  .object({
    completions: z.array(dailyCompletionSummarySchema).describe('완료 정보 목록'),
    totalCompleteDays: z.number().int().min(0).describe('100% 완료한 날 수'),
    dateRange: z
      .object({
        startDate: z.string().describe('시작 날짜'),
        endDate: z.string().describe('종료 날짜'),
      })
      .describe('조회 날짜 범위'),
  })
  .describe('날짜 범위 완료 정보 응답')
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

/**
 * 월간 통계 응답
 */
export const monthlyStatsResponseSchema = z
  .object({
    year: z.number().int().describe('연도'),
    month: z.number().int().min(1).max(12).describe('월'),
    totalCompleteDays: z.number().int().min(0).describe('100% 완료한 날 수'),
    totalDaysWithTodos: z.number().int().min(0).describe('Todo가 있던 날 수'),
    averageCompletionRate: z.number().min(0).max(100).describe('평균 완료율 (%)'),
    longestStreak: z.number().int().min(0).describe('최장 연속 완료 일수'),
    currentStreak: z.number().int().min(0).describe('현재 연속 완료 일수'),
  })
  .describe('월간 통계 응답')
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
