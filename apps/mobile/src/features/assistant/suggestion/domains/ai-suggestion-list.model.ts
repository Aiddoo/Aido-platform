import { z } from 'zod';

import { aiSuggestionSchema } from './ai-suggestion.model';
import { suggestionAnalysisSchema, type SuggestionAnalysis } from './suggestion-analysis.model';

const aiSuggestionListSchema = z.object({
  suggestions: z.array(aiSuggestionSchema),
  analysis: suggestionAnalysisSchema.nullable(),
});
export type AiSuggestionList = z.infer<typeof aiSuggestionListSchema>;

/** 제안 화면이 그리는 상태. 서버가 앞으로 더할 모르는 상태는 다음 분석을 기다리는 것으로 본다 */
type SuggestionDisplayState = Exclude<SuggestionAnalysis['state'], 'UNKNOWN'>;

export const AiSuggestionListPolicy = {
  /** 대기 중인 제안이 있으면 서버 분석 상태와 상관없이 제안을 보인다 */
  getDisplayState(list: AiSuggestionList): SuggestionDisplayState {
    if (list.suggestions.length > 0) {
      return 'HAS_SUGGESTIONS';
    }
    if (list.analysis == null || list.analysis.state === 'UNKNOWN') {
      return 'WAITING_FOR_NEXT_RUN';
    }
    return list.analysis.state;
  },
};
