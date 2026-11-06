import { recurringSuggestionSchema, suggestionActionSchema } from '@aido/api';
import { z } from 'zod';

const aiSuggestionModelSchema = recurringSuggestionSchema.extend({
  expiresAt: z.date(),
  createdAt: z.date(),
});
export type AiSuggestion = z.infer<typeof aiSuggestionModelSchema>;

const aiSuggestionActionInputSchema = suggestionActionSchema;
export type AiSuggestionActionInput = z.infer<typeof aiSuggestionActionInputSchema>;

const aiSuggestionActionResultSchema = z.object({
  message: z.string(),
  suggestion: aiSuggestionModelSchema,
  createdTodosCount: z.number().optional(),
});
export type AiSuggestionActionResult = z.infer<typeof aiSuggestionActionResultSchema>;
