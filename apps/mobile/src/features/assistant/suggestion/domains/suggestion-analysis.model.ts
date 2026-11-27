import { AI_SUGGESTION_ANALYSIS_STATES } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const suggestionAnalysisSchema = z.object({
  state: z.enum([...AI_SUGGESTION_ANALYSIS_STATES, 'UNKNOWN']),
  canRequestNow: z.boolean(),
  nextAnalysisAt: instantSchema,
});
export type SuggestionAnalysis = z.infer<typeof suggestionAnalysisSchema>;

export const SuggestionAnalysisPolicy = {
  shouldWaitForResult(analysis: SuggestionAnalysis): boolean {
    return analysis.state === 'ANALYZING';
  },
};
