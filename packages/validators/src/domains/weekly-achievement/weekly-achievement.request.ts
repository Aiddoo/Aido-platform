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
