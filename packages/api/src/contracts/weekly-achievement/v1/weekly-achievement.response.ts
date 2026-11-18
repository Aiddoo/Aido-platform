import { z } from "zod";

import { dateSchema, datetimeSchema } from "../../../common/datetime.js";
import { cursorPageSchema } from "../../../common/pagination.js";

const weeklyAchievementSchema = z
  .object({
    id: z.int().meta({ description: "주간 달성 기록 ID (양의 정수)" }),
    year: z.int().meta({ description: "ISO 연도 (예: 2026)" }),
    week: z.int().min(1).max(53).meta({ description: "ISO 주차 (1-53)" }),
    weekLabel: z.string().meta({ description: "주차 라벨 (예: 3월 2주차)" }),
    dateRange: z
      .object({
        startDate: dateSchema.meta({ description: "주 시작일 월요일 (YYYY-MM-DD)" }),
        endDate: dateSchema.meta({ description: "주 종료일 일요일 (YYYY-MM-DD)" }),
      })
      .meta({ description: "해당 주의 날짜 범위" }),
    totalTodos: z.int().nonnegative().meta({ description: "총 할 일 수" }),
    completedTodos: z.int().nonnegative().meta({ description: "완료한 할 일 수" }),
    completionRate: z.number().min(0).max(100).meta({ description: "완료율 (0-100%)" }),
    achievedAt: datetimeSchema.meta({ description: "달성 시점 (ISO 8601 UTC)" }),
  })
  .meta({
    example: {
      id: 42,
      year: 2026,
      week: 10,
      weekLabel: "3월 2주차",
      dateRange: { startDate: "2026-03-02", endDate: "2026-03-08" },
      totalTodos: 15,
      completedTodos: 14,
      completionRate: 93,
      achievedAt: "2026-03-08T11:00:00.000Z",
    },
  });

export type WeeklyAchievementDto = z.infer<typeof weeklyAchievementSchema>;

export const weeklyAchievementSummarySchema = z
  .object({
    totalWeeks: z.int().nonnegative().meta({ description: "기록된 총 주 수" }),
    perfectWeeks: z.int().nonnegative().meta({ description: "100% 달성 주 수" }),
    currentStreak: z.int().nonnegative().meta({ description: "현재 연속 달성 주" }),
    bestStreak: z.int().nonnegative().meta({ description: "최고 연속 달성 기록" }),
    averageRate: z.number().min(0).max(100).meta({ description: "평균 완료율 (0-100%)" }),
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

export const weeklyAchievementListResponseSchema = cursorPageSchema(
  weeklyAchievementSchema,
  z.int(),
  { items: "주간 달성 목록", pagination: "페이지네이션 정보" },
)
  .extend({ summary: weeklyAchievementSummarySchema.meta({ description: "전체 통계 요약" }) })
  .meta({
    example: {
      items: [
        {
          id: 42,
          year: 2026,
          week: 10,
          weekLabel: "3월 2주차",
          dateRange: { startDate: "2026-03-02", endDate: "2026-03-08" },
          totalTodos: 15,
          completedTodos: 14,
          completionRate: 93,
          achievedAt: "2026-03-08T11:00:00.000Z",
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

export const weeklyAchievementYearsResponseSchema = z
  .object({
    years: z.array(z.int()).meta({
      description: "주간 달성 기록이 하나라도 있는 ISO 연도 (내림차순, 기록이 없으면 빈 배열)",
    }),
  })
  .meta({ example: { years: [2027, 2026] } });

export type WeeklyAchievementYearsResponse = z.infer<typeof weeklyAchievementYearsResponseSchema>;
