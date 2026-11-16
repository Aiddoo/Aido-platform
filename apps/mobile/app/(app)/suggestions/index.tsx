import { SuggestionStatus } from '@src/features/assistant/suggestion/components/suggestion-status';
import { SuggestionsList } from '@src/features/assistant/suggestion/components/suggestions-list';
import { refreshAiSuggestions } from '@src/features/assistant/suggestion/queries/suggestion-cache';
import { useFeatureAccess } from '@src/features/billing/subscription/hooks/use-feature-access';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import {
  QueryErrorBoundary,
  ReadableContent,
  SafeAreaScrollView,
  ScallopedContainer,
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
            // 상태 머리와 제안 줄이 같은 목록 쿼리를 읽어 경계 하나로 묶는다. 실패하면 다시 시도 하나가 둘을 함께 다시 받는다
            <QueryErrorBoundary fallback={SuggestionsList.Error}>
              <Suspense fallback={<SuggestionStatus.Loading />}>
                <ScallopedContainer testID="suggestions-status">
                  <SuggestionStatus />
                  <SuggestionsList />
                </ScallopedContainer>
              </Suspense>
            </QueryErrorBoundary>
          ))
          .with('free', () => <SuggestionsList.Free />)
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
