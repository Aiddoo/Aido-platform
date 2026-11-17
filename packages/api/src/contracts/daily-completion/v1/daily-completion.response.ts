import { z } from "zod";

export const dailyCompletionSummarySchema = z
  .object({
    date: z.string().meta({ description: "날짜 (YYYY-MM-DD, 예: 2026-01-17)" }),
    totalTodos: z.int().min(0).meta({ description: "해당 날짜 전체 할 일 개수 (0 이상)" }),
    completedTodos: z.int().min(0).meta({ description: "완료한 할 일 개수 (0 이상)" }),
    isComplete: z.boolean().meta({ description: "100% 달성 여부 (completedTodos === totalTodos)" }),
    completionRate: z
      .number()
      .min(0)
      .max(100)
      .meta({ description: "완료율(0~100 정수). 다 끝냈을 때만 100, 하나라도 끝냈으면 1 이상" }),
    categoryColors: z
      .array(z.string())
      .meta({ description: "해당 날짜 할 일의 카테고리 색상 (HEX, 중복 제거, 오름차순)" }),
  })
  .meta({
    example: {
      date: "2026-01-17",
      totalTodos: 5,
      completedTodos: 5,
      isComplete: true,
      completionRate: 100,
      categoryColors: ["#4A90D9", "#FF6B43"],
    },
  });

export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummarySchema>;

export const multiDayTodoSpanSchema = z.object({
  startDate: z.string().meta({ description: "할 일 시작 날짜 (YYYY-MM-DD)" }),
  endDate: z.string().meta({ description: "할 일 끝 날짜 (YYYY-MM-DD)" }),
  completed: z.boolean().meta({ description: "완료 여부" }),
  categoryColor: z.string().meta({ description: "카테고리 색상" }),
});

export const dailyCompletionsRangeResponseSchema = z
  .object({
    completions: z
      .array(dailyCompletionSummarySchema)
      .meta({ description: "기간 내 일별 달성 요약 배열" }),
    totalCompleteDays: z.int().min(0).meta({ description: "100% 달성한 날 개수 (0 이상)" }),
    multiDayTodos: z.array(multiDayTodoSpanSchema).optional().meta({
      description:
        "출시 앱(1.15.0) 호환 칸이라 항상 빈 배열이다. completions가 여러 날 할 일을 기간의 모든 날에 이미 센다",
    }),
    dateRange: z
      .object({
        startDate: z.string().meta({ description: "조회 시작 날짜 (YYYY-MM-DD, 예: 2026-01-15)" }),
        endDate: z.string().meta({ description: "조회 종료 날짜 (YYYY-MM-DD, 예: 2026-01-17)" }),
      })
      .meta({ description: "조회 날짜 범위" }),
  })
  .meta({
    example: {
      completions: [
        {
          date: "2026-01-15",
          totalTodos: 3,
          completedTodos: 3,
          isComplete: true,
          completionRate: 100,
          categoryColors: ["#FF6B43"],
        },
        {
          date: "2026-01-16",
          totalTodos: 4,
          completedTodos: 2,
          isComplete: false,
          completionRate: 50,
          categoryColors: ["#4A90D9", "#FF6B43"],
        },
        {
          date: "2026-01-17",
          totalTodos: 5,
          completedTodos: 5,
          isComplete: true,
          completionRate: 100,
          categoryColors: ["#4A90D9"],
        },
      ],
      totalCompleteDays: 2,
      dateRange: {
        startDate: "2026-01-15",
        endDate: "2026-01-17",
      },
    },
  });

export type DailyCompletionsRangeResponse = z.infer<typeof dailyCompletionsRangeResponseSchema>;
