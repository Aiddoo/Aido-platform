import { SuggestionsList } from '@src/features/assistant/suggestion/components/suggestions-list';
import { refreshAiSuggestions } from '@src/features/assistant/suggestion/queries/suggestion-cache';
import { useFeatureAccess } from '@src/features/billing/subscription/hooks/use-feature-access';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  ReadableContent,
  Spacing,
  SafeAreaScrollView,
  VStack,
  TintedRefreshControl,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function SuggestionsScreen() {
  const { t } = useTranslation('ai');
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
            <VStack gap={12}>
              <AiConsentNotice title={t('consent.notice.suggestions')} />

              <QueryErrorBoundary fallback={SuggestionsList.Error}>
                <Suspense fallback={<SuggestionsList.Loading />}>
                  <SuggestionsList />
                </Suspense>
              </QueryErrorBoundary>
            </VStack>
          ))
          .with('free', () => <SuggestionsList.PremiumPreview />)
          .with('error', () => (
            <SuggestionsList.Error
              error={featureAccess.error}
              reset={() => featureAccess.refetch()}
            />
          ))
          .with('loading', () => <SuggestionsList.Loading />)
          .exhaustive()}
      </ReadableContent>

      <Spacing size={32} />
    </SafeAreaScrollView>
  );
}
