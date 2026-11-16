import type { AiSuggestionList, SuggestionAnalysis } from '../domains/suggestion-analysis.model';

export type SuggestionDisplayState = Exclude<SuggestionAnalysis['state'], 'UNKNOWN'>;

export function getSuggestionDisplayState(list: AiSuggestionList): SuggestionDisplayState {
  if (list.suggestions.length > 0) {
    return 'HAS_SUGGESTIONS';
  }
  if (list.analysis == null || list.analysis.state === 'UNKNOWN') {
    return 'WAITING_FOR_NEXT_RUN';
  }
  return list.analysis.state;
}
