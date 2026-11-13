import { queryOptions } from '@tanstack/react-query';

import type { AiSuggestion } from '../domains/suggestion.model';

export const SUGGESTION_QUERY_KEYS = {
  all: ['suggestion'] as const,
  list: () =>
    queryOptions<AiSuggestion[]>({ queryKey: [...SUGGESTION_QUERY_KEYS.all, 'list'] }).queryKey,
} as const;
