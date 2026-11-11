import { useSuggestionService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { SUGGESTION_QUERY_KEYS } from './suggestion-query-keys';

export function useGetSuggestionsQueryOptions() {
  const suggestionService = useSuggestionService();

  return queryOptions({
    queryKey: SUGGESTION_QUERY_KEYS.list(),
    queryFn: async ({ signal }) => unwrap(await suggestionService.getSuggestions(signal)),
    meta: { refreshOnPremiumChange: true },
  });
}
