import { SuggestionsList } from '@src/features/assistant/suggestion/components/suggestions-list';
import { invalidateAiSuggestions } from '@src/features/assistant/suggestion/queries/suggestion-cache';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  VStack,
  TintedRefreshControl,
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
import { match, P } from 'ts-pattern';

export default function SuggestionsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  // 권한을 기다리느라 화면 전체가 막히지 않게 한다. 영속 캐시가 있으면 첫 렌더부터 값이 있다
  const entitlementsQuery = useQuery(useGetEntitlementsQueryOptions());
  const view = match(entitlementsQuery.data)
    .with(P.nullish, () => (entitlementsQuery.isError ? 'error' : 'loading'))
    .otherwise((entitlements) =>
      EntitlementPolicy.canUseFeature(entitlements, 'AI_SUGGESTION') ? 'premium' : 'free',
    );
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateAiSuggestions(queryClient));

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow pb-8"
        refreshControl={
          view === 'premium' ? (
            <TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          ) : undefined
        }
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          <ReadableContent className="grow px-4">
            <Spacing size={16} />

            {match(view)
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
                  error={entitlementsQuery.error}
                  reset={() => entitlementsQuery.refetch()}
                />
              ))
              .with('loading', () => <SuggestionsList.Loading />)
              .exhaustive()}
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
