import { DAYS_OF_WEEK } from '@aido/api/vocabulary';
import { z } from 'zod';

const aiSuggestionSchema = z.object({
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
