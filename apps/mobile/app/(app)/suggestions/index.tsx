import { ScallopedContainer } from '@src/features/ai/presentations/components/ScallopedContainer';
import { SuggestionsList } from '@src/features/ai/presentations/components/SuggestionsList';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useRefresh } from '@src/shared/hooks/useRefresh';
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
import { useRouter } from 'expo-router';
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
  const router = useRouter();

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
          AI가 투두를 제안해드려요
        </H4>
        <Text size="b4" shade={6} align="center">
          반복 패턴을 분석해서 맞춤 투두를 추천받을 수 있어요
        </Text>
      </View>

      <Spacing size={20} />

      <View className="px-4 pb-4">
        <View className="py-2 opacity-60">
          <VStack gap={8}>
            <VStack gap={4}>
              <HStack justify="between" align="center">
                <Text size="b2" weight="semibold" shade={9}>
                  매일 아침 스트레칭
                </Text>
                <Text size="e1" shade={5}>
                  신뢰도 92%
                </Text>
              </HStack>
              <Text size="b4" shade={7}>
                월, 화, 수, 목, 금 · 07:30
              </Text>
            </VStack>
            <Text size="b4" shade={6}>
              최근 2주간 아침 운동 패턴이 감지되었어요
            </Text>
          </VStack>
        </View>

        <Spacing size={16} />

        <Button size="medium" onPress={() => router.push('/settings/subscription')}>
          구독하고 제안 받기
        </Button>
      </View>
    </ScallopedContainer>
  );
}
