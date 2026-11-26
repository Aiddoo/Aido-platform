import { DAYS_OF_WEEK } from '@aido/api/vocabulary';
import type { TodoRepeat } from '@src/features/planning/todo/domains/todo-repeat.model';
import { z } from 'zod';

export const aiSuggestionSchema = z.object({
  id: z.number(),
  title: z.string(),
  daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)),
  scheduledTime: z.string().nullable(),
  suggestedCategoryId: z.int().positive().nullable(),
  evidence: z
    .object({
      recordedCount: z.int().positive(),
      completedCount: z.int().nonnegative(),
      periodDays: z.int().positive(),
    })
    .nullable(),
});
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export const AiSuggestionPolicy = {
  /** 제안은 끝나는 날을 정하지 않아 일정 줄이 주기만 그리도록 끝없이 반복한다 */
  getTodoRepeat(suggestion: AiSuggestion): TodoRepeat {
    return {
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: suggestion.daysOfWeek,
      end: { type: 'NEVER' },
    };
  },
};
