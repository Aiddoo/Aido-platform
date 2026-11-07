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
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

export default function SuggestionsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  // 권한을 기다리느라 화면 전체가 막히지 않게 한다. 영속 캐시가 있으면 첫 렌더부터 값이 있다
  const entitlementsQuery = useQuery({ ...useGetEntitlementsQueryOptions(), throwOnError: false });
  const canViewSuggestions =
    entitlementsQuery.data == null
      ? undefined
      : !EntitlementPolicy.isFeatureLocked(entitlementsQuery.data, 'AI_SUGGESTION');
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateAiSuggestions(queryClient));
  const { color: refreshTint } = useResolveClassNames('text-main');

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow pb-8"
        refreshControl={
          canViewSuggestions === true ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={refreshTint}
              colors={refreshTint == null ? undefined : [refreshTint]}
            />
          ) : undefined
        }
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          <ReadableContent className="grow px-4">
            <Spacing size={16} />

            {match(canViewSuggestions)
              .with(true, () => (
                <VStack gap={12}>
                  <AiConsentNotice title={t('consent.notice.suggestions')} />

                  <QueryErrorBoundary fallback={SuggestionsList.Error}>
                    <Suspense fallback={<SuggestionsList.Loading />}>
                      <SuggestionsList />
                    </Suspense>
                  </QueryErrorBoundary>
                </VStack>
              ))
              .with(false, () => <SuggestionsList.PremiumPreview />)
              .with(undefined, () =>
                entitlementsQuery.isError ? (
                  <SuggestionsList.Error
                    error={entitlementsQuery.error}
                    reset={() => entitlementsQuery.refetch()}
                  />
                ) : (
                  <SuggestionsList.Loading />
                ),
              )
              .exhaustive()}
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
