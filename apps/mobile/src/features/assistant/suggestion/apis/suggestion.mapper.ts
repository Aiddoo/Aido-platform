import type {
  RecurringSuggestion as RecurringSuggestionDto,
  SuggestionActionResponse as SuggestionActionResponseDto,
} from '@aido/api';

import type { AiSuggestion, AiSuggestionActionResult } from '../domains/suggestion.model';

export const toAiSuggestion = (dto: RecurringSuggestionDto): AiSuggestion => ({
  ...dto,
  expiresAt: new Date(dto.expiresAt),
  createdAt: new Date(dto.createdAt),
});

export const toAiSuggestionActionResult = (
  dto: SuggestionActionResponseDto,
): AiSuggestionActionResult => ({ ...dto, suggestion: toAiSuggestion(dto.suggestion) });
