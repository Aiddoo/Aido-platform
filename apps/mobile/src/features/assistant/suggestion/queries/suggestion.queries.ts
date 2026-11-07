import { useSuggestionService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { SUGGESTION_QUERY_KEYS } from '../constants/suggestion-query-keys';
import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';

export function useGetSuggestionsQueryOptions() {
  const suggestionService = useSuggestionService();

  return queryOptions({
    queryKey: SUGGESTION_QUERY_KEYS.all,
    queryFn: async ({ signal }) => unwrap(await suggestionService.getSuggestions(signal)),
    throwOnError: (error, query) =>
      query.state.data == null && !isSuggestionsPremiumRequiredError(error),
    meta: { refreshOnPremiumChange: true },
  });
}
