import { useSuggestionApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { SUGGESTION_QUERY_KEYS } from './suggestion-query-keys';

export function useGetSuggestionsQueryOptions() {
  const suggestionApi = useSuggestionApi();

  return queryOptions({
    queryKey: SUGGESTION_QUERY_KEYS.list(),
    queryFn: async ({ signal }) => unwrap(await suggestionApi.getSuggestions(signal)),
    meta: { refreshOnPremiumChange: true },
  });
}
