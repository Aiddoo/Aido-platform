import { SuggestionsList } from '@src/features/ai/presentations/components/SuggestionsList';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView } from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useCallback } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

const SuggestionsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<SuggestionsList.Loading />}>
          <SuggestionsContent />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
};

export default SuggestionsScreen;

function SuggestionsContent() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() }),
    [queryClient],
  );
  const [isRefreshing, handleRefresh] = useRefresh(invalidate);

  const isPremiumUser = UserPolicy.isPremiumUser(user);

  if (!isPremiumUser) {
    return (
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
      >
        <Spacing size={16} />
        <SuggestionsList.PremiumPreview />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 px-4"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Spacing size={16} />
      <QueryErrorBoundary>
        <SuggestionsList />
      </QueryErrorBoundary>
    </ScrollView>
  );
}
