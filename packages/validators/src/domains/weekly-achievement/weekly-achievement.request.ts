import { z } from 'zod';

export const getWeeklyAchievementsQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2024, '2024년 이후만 조회할 수 있습니다')
    .max(2100)
    .describe('조회할 연도 (예: 2026)'),
  cursor: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('페이지네이션 커서 (마지막 조회 ID, 0 이상)'),
  size: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(20)
    .describe('페이지 크기 (1-200, 기본값: 20)'),
});

export type GetWeeklyAchievementsQueryInput = z.infer<typeof getWeeklyAchievementsQuerySchema>;

export const weeklyAchievementParamSchema = z.object({
  year: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 연도입니다')
    .describe('연도 (양의 정수, 예: 2026)'),
  week: z.coerce
    .number()
    .int()
    .min(1, '주차는 1 이상이어야 합니다')
    .max(53, '주차는 53 이하여야 합니다')
    .describe('주차 (1-53, 예: 12)'),
});

export type WeeklyAchievementParam = z.infer<typeof weeklyAchievementParamSchema>;
