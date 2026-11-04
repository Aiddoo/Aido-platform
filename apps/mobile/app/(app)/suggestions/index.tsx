import { AiConsentNotice } from '@src/features/ai/components/ai-consent-notice';
import { SuggestionsList } from '@src/features/ai/components/suggestions-list';
import { invalidateAiSuggestions } from '@src/features/ai/queries/ai-cache';
import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function SuggestionsScreen() {
  const { t } = useTranslation('ai');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateAiSuggestions(queryClient));

  const hasFullAccess = EntitlementPolicy.hasFullAccess(entitlements);

  return (
    <ScrollView
      className="flex-1 px-4"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
      refreshControl={
        hasFullAccess ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <Spacing size={16} />
        {match(hasFullAccess)
          .with(true, () => (
            <VStack gap={12}>
              <AiConsentNotice>{t('consent.notice.suggestions')}</AiConsentNotice>
              <QueryErrorBoundary fallback={(props) => <SuggestionsList.Error {...props} />}>
                <Suspense fallback={<SuggestionsList.Loading />}>
                  <SuggestionsList />
                </Suspense>
              </QueryErrorBoundary>
            </VStack>
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
        <Suspense
          fallback={
            <Box className="px-4 pt-4">
              <SuggestionsList.Loading />
            </Box>
          }
        >
          <SuggestionsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
