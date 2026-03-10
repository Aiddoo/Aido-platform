import { z } from 'zod';

import { dateSchema, datetimeSchema } from '../../common/datetime';
import { numberCursorPaginationInfoSchema } from '../../common/pagination';

export const weeklyAchievementSchema = z
  .object({
    id: z.number().int().describe('주간 달성 기록 ID (양의 정수)'),
    year: z.number().int().describe('ISO 연도 (예: 2026)'),
    week: z.number().int().min(1).max(53).describe('ISO 주차 (1-53)'),
    weekLabel: z.string().describe('주차 라벨 (예: 3월 2주차)'),
    dateRange: z
      .object({
        startDate: dateSchema.describe('주 시작일 월요일 (YYYY-MM-DD)'),
        endDate: dateSchema.describe('주 종료일 일요일 (YYYY-MM-DD)'),
      })
      .describe('해당 주의 날짜 범위'),
    totalTodos: z.number().int().nonnegative().describe('총 할 일 수'),
    completedTodos: z.number().int().nonnegative().describe('완료한 할 일 수'),
    completionRate: z.number().min(0).max(100).describe('완료율 (0-100%)'),
    achievedAt: datetimeSchema.describe('달성 시점 (ISO 8601 UTC)'),
  })
  .meta({
    example: {
      id: 42,
      year: 2026,
      week: 10,
      weekLabel: '3월 2주차',
      dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
      totalTodos: 15,
      completedTodos: 14,
      completionRate: 93,
      achievedAt: '2026-03-08T11:00:00.000Z',
    },
  });

export type WeeklyAchievementDto = z.infer<typeof weeklyAchievementSchema>;

export const weeklyAchievementSummarySchema = z
  .object({
    totalWeeks: z.number().int().nonnegative().describe('기록된 총 주 수'),
    perfectWeeks: z.number().int().nonnegative().describe('100% 달성 주 수'),
    currentStreak: z.number().int().nonnegative().describe('현재 연속 달성 주'),
    bestStreak: z.number().int().nonnegative().describe('최고 연속 달성 기록'),
    averageRate: z.number().min(0).max(100).describe('평균 완료율 (0-100%)'),
  })
  .meta({
    example: {
      totalWeeks: 8,
      perfectWeeks: 3,
      currentStreak: 4,
      bestStreak: 6,
      averageRate: 87,
    },
  });

export type WeeklyAchievementSummary = z.infer<typeof weeklyAchievementSummarySchema>;

export const weeklyAchievementListResponseSchema = z
  .object({
    items: z.array(weeklyAchievementSchema).describe('주간 달성 목록'),
    pagination: numberCursorPaginationInfoSchema.describe('페이지네이션 정보'),
    summary: weeklyAchievementSummarySchema.describe('전체 통계 요약'),
  })
  .meta({
    example: {
      items: [
        {
          id: 42,
          year: 2026,
          week: 10,
          weekLabel: '3월 2주차',
          dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
          totalTodos: 15,
          completedTodos: 14,
          completionRate: 93,
          achievedAt: '2026-03-08T11:00:00.000Z',
        },
      ],
      pagination: { nextCursor: 21, hasNext: true, size: 20 },
      summary: {
        totalWeeks: 8,
        perfectWeeks: 3,
        currentStreak: 4,
        bestStreak: 6,
        averageRate: 87,
      },
    },
  });

export type WeeklyAchievementListResponse = z.infer<typeof weeklyAchievementListResponseSchema>;

export const weeklyAchievementDetailResponseSchema = weeklyAchievementSchema;

export type WeeklyAchievementDetailResponse = z.infer<typeof weeklyAchievementDetailResponseSchema>;
