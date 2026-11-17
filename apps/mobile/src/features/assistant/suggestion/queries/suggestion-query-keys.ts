import { queryOptions } from '@tanstack/react-query';

import type { AiSuggestionList } from '../domains/suggestion-analysis.model';

export const SUGGESTION_QUERY_KEYS = {
  all: ['suggestion'] as const,
  list: () =>
    queryOptions<AiSuggestionList>({ queryKey: [...SUGGESTION_QUERY_KEYS.all, 'list'] }).queryKey,
} as const;
