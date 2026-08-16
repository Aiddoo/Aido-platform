import { ScallopedContainer } from '@src/features/ai/presentations/components/ScallopedContainer';
import { SuggestionsList } from '@src/features/ai/presentations/components/SuggestionsList';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  H4,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense, useCallback } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';

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
        <SuggestionsPremiumPreview />
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
        <Suspense fallback={<SuggestionsList.Loading />}>
          <SuggestionsList />
        </Suspense>
      </QueryErrorBoundary>
    </ScrollView>
  );
}

function SuggestionsPremiumPreview() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('ai');

  return (
    <ScallopedContainer>
      <View className="items-center px-5 pt-4">
        <Image
          source={require('@assets/images/ido_cat_suggestion.webp')}
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
        <Spacing size={8} />
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {t('suggestions.paywall.title')}
        </H4>
        <Text size="b4" shade={6} align="center">
          {t('suggestions.paywall.description')}
        </Text>
      </View>

      <Spacing size={20} />

      <View className="px-4 pb-4">
        <View className="py-2 opacity-60">
          <VStack gap={8}>
            <VStack gap={4}>
              <HStack justify="between" align="center">
                <Text size="b2" weight="semibold" shade={9}>
                  {t('suggestions.paywall.sampleTitle')}
                </Text>
                <Text size="e1" shade={5}>
                  {t('suggestions.paywall.sampleConfidence')}
                </Text>
              </HStack>
              <Text size="b4" shade={7}>
                {t('suggestions.paywall.sampleSchedule')}
              </Text>
            </VStack>
            <Text size="b4" shade={6}>
              {t('suggestions.paywall.sampleReason')}
            </Text>
          </VStack>
        </View>

        <Spacing size={16} />

        <Button size="medium" onPress={() => push('/settings/subscription')}>
          {t('suggestions.paywall.subscribeCta')}
        </Button>
      </View>
    </ScallopedContainer>
  );
}
