import { dateSchema } from '@aido/validators';
import { z } from 'zod';

export const STORE_REVIEW_MAX_COMPLETION_RECORDS = 50;
export const storeReviewCompletionSchema = z.object({
  todoId: z.number().int().positive(),
  localDate: dateSchema,
});
export const storeReviewPromptStateSchema = z.object({
  completions: z.array(storeReviewCompletionSchema).max(STORE_REVIEW_MAX_COMPLETION_RECORDS),
  dismissedAt: z.date().nullable(),
  reviewRequestedAt: z.date().nullable(),
});
export type StoreReviewCompletion = z.infer<typeof storeReviewCompletionSchema>;
export type StoreReviewPromptState = z.infer<typeof storeReviewPromptStateSchema>;
export const createEmptyStoreReviewPromptState = (): StoreReviewPromptState => ({
  completions: [],
  dismissedAt: null,
  reviewRequestedAt: null,
});
