import { TODAY_SUMMARY_TOP_TODOS_MAX } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { completionRateSchema } from '@src/shared/domains/completion-rate.model';
import { z } from 'zod';

// 홈 위젯이 보이는 하루 요약. 숫자와 달성 여부는 서버가 계산한다
export const todoSummarySchema = z.object({
  date: dateKeySchema,
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  completionRate: completionRateSchema,
  isComplete: z.boolean(),
  currentStreak: z.int().min(0),
  topTodos: z
    .array(
      z.object({
        id: z.int(),
        title: z.string(),
        completed: z.boolean(),
        categoryColor: z.string(),
      }),
    )
    .max(TODAY_SUMMARY_TOP_TODOS_MAX),
});
export type TodoSummary = z.infer<typeof todoSummarySchema>;
