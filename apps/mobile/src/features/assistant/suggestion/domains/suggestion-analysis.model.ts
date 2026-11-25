import { AI_SUGGESTION_ANALYSIS_STATES } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import type { AiSuggestion } from './suggestion.model';

const suggestionAnalysisSchema = z.object({
  state: z.enum([...AI_SUGGESTION_ANALYSIS_STATES, 'UNKNOWN']),
  canRequestNow: z.boolean(),
  nextAnalysisAt: instantSchema,
});
export type SuggestionAnalysis = z.infer<typeof suggestionAnalysisSchema>;

export interface AiSuggestionList {
  suggestions: AiSuggestion[];
  analysis: SuggestionAnalysis | null;
}

export const SuggestionAnalysisPolicy = {
  shouldWaitForResult(analysis: SuggestionAnalysis): boolean {
    return analysis.state === 'ANALYZING';
  },
};
