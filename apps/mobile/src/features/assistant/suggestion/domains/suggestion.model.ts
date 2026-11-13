import { DAYS_OF_WEEK } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const aiSuggestionSchema = z.object({
  id: z.number(),
  title: z.string(),
  daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)),
  scheduledTime: z.string().nullable(),
  confidence: z.number(),
  reason: z.string(),
  expiresAt: instantSchema,
  suggestedCategoryId: z.int().positive().nullable(),
});
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
