import type { RecurringSuggestion } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { AiSuggestion } from '../domains/suggestion.model';

export function toAiSuggestion(dto: RecurringSuggestion): AiSuggestion {
  return {
    ...pick(dto, [
      'id',
      'title',
      'daysOfWeek',
      'scheduledTime',
      'confidence',
      'reason',
      'suggestedCategoryId',
    ]),
    expiresAt: toInstant(dto.expiresAt),
  };
}
