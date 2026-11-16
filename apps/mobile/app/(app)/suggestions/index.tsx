import { SuggestionStatus } from '@src/features/assistant/suggestion/components/suggestion-status';
import { SuggestionsList } from '@src/features/assistant/suggestion/components/suggestions-list';
import { refreshAiSuggestions } from '@src/features/assistant/suggestion/queries/suggestion-cache';
import { useFeatureAccess } from '@src/features/billing/subscription/hooks/use-feature-access';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import {
  QueryErrorBoundary,
  ReadableContent,
  SafeAreaScrollView,
  Spacing,
  TintedRefreshControl,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function SuggestionsScreen() {
  const queryClient = useQueryClient();
  const featureAccess = useFeatureAccess('AI_SUGGESTION');
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshAiSuggestions(queryClient));

  return (
    <SafeAreaScrollView
      className="flex-1 bg-white"
      contentContainerClassName="grow"
      refreshControl={
        featureAccess.status === 'premium' ? (
          <TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
    >
      <ReadableContent className="grow px-4">
        <Spacing size={16} />

        {match(featureAccess.status)
          .with('premium', () => (
            <>
              <QueryErrorBoundary fallback={SuggestionStatus.Error}>
                <Suspense fallback={<SuggestionStatus.Loading />}>
                  <SuggestionStatus />
                </Suspense>
              </QueryErrorBoundary>

              <Spacing size={12} />

              <QueryErrorBoundary fallback={SuggestionsList.Error}>
                <Suspense fallback={<SuggestionsList.Loading />}>
                  <SuggestionsList />
                </Suspense>
              </QueryErrorBoundary>
            </>
          ))
          .with('free', () => <SuggestionsList.PremiumPreview />)
          .with('error', () => (
            <SuggestionStatus.Error
              error={featureAccess.error}
              reset={() => featureAccess.refetch()}
            />
          ))
          .with('loading', () => <SuggestionStatus.Loading />)
          .exhaustive()}
      </ReadableContent>

      <Spacing size={32} />
    </SafeAreaScrollView>
  );
}
