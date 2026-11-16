import type {
  RecurringSuggestion,
  SuggestionAnalysis as SuggestionAnalysisDto,
  SuggestionListResponse,
} from '@aido/api';
import { toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { AiSuggestionList, SuggestionAnalysis } from '../domains/suggestion-analysis.model';
import type { AiSuggestion } from '../domains/suggestion.model';

export function toAiSuggestion(dto: RecurringSuggestion): AiSuggestion {
  return {
    ...pick(dto, ['id', 'title', 'daysOfWeek', 'scheduledTime', 'suggestedCategoryId']),
    evidence: dto.evidence ?? null,
  };
}

export function toSuggestionAnalysis(dto: SuggestionAnalysisDto): SuggestionAnalysis {
  return {
    ...pick(dto, ['state', 'canRequestNow']),
    nextAnalysisAt: toInstant(dto.nextAnalysisAt),
  };
}

export function toAiSuggestionList(dto: SuggestionListResponse): AiSuggestionList {
  return {
    suggestions: dto.suggestions.map(toAiSuggestion),
    analysis: dto.analysis == null ? null : toSuggestionAnalysis(dto.analysis),
  };
}
