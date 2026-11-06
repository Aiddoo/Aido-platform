import { invalidateAiSuggestions } from '@src/features/ai/queries/ai-cache';
import { SuggestionsList } from '@src/features/assistant/suggestion/components/suggestions-list';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/get-entitlements-query-options';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function SuggestionsScreen() {
  const { t } = useTranslation('ai');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateAiSuggestions(queryClient));

  const canViewSuggestions = !EntitlementPolicy.isFeatureLocked(entitlements, 'AI_SUGGESTION');

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
      refreshControl={
        canViewSuggestions ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <ReadableContent className="grow px-4">
          <Spacing size={16} />
          {match(canViewSuggestions)
            .with(true, () => (
              <VStack gap={12}>
                <AiConsentNotice>{t('consent.notice.suggestions')}</AiConsentNotice>
                <QueryErrorBoundary fallback={SuggestionsList.Error}>
                  <Suspense fallback={<SuggestionsList.Loading />}>
                    <SuggestionsList />
                  </Suspense>
                </QueryErrorBoundary>
              </VStack>
            ))
            .with(false, () => <SuggestionsList.PremiumPreview />)
            .exhaustive()}
        </ReadableContent>
      </StyledSafeAreaView>
    </ScrollView>
  );
}

export default function SuggestionsRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense
          fallback={
            <ReadableContent className="px-4 pt-4">
              <SuggestionsList.Loading />
            </ReadableContent>
          }
        >
          <SuggestionsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
