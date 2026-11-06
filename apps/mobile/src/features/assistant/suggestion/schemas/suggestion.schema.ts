import {
  suggestionActionResponseSchema,
  type suggestionActionSchema,
  suggestionListResponseSchema,
  recurringSuggestionSchema as recurringSuggestionContractSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const recurringSuggestionSchema = recurringSuggestionContractSchema.extend({
  expiresAt: instantSchema,
  createdAt: instantSchema,
});
export type AiSuggestion = z.infer<typeof recurringSuggestionSchema>;

export const suggestionListResultSchema = suggestionListResponseSchema.extend({
  suggestions: z.array(recurringSuggestionSchema),
});

export const suggestionActionResultSchema = suggestionActionResponseSchema.extend({
  suggestion: recurringSuggestionSchema,
});

export type AiSuggestionActionInput = z.infer<typeof suggestionActionSchema>;
