import { SuggestionsList } from '@src/features/ai/components/suggestions-list';
import { AI_QUERY_KEYS } from '@src/features/ai/constants/ai-query-keys';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView } from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useCallback } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function SuggestionsScreen() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() }),
    [queryClient],
  );
  const [isRefreshing, handleRefresh] = useRefresh(invalidate);

  const isPremiumUser = UserPolicy.isPremiumUser(user);

  return (
    <ScrollView
      className="flex-1 px-4"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
      refreshControl={
        isPremiumUser ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <Spacing size={16} />
        {match(isPremiumUser)
          .with(true, () => (
            <QueryErrorBoundary>
              <SuggestionsList />
            </QueryErrorBoundary>
          ))
          .with(false, () => <SuggestionsList.PremiumPreview />)
          .exhaustive()}
      </StyledSafeAreaView>
    </ScrollView>
  );
}

export default function SuggestionsRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<SuggestionsList.Loading />}>
          <SuggestionsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
