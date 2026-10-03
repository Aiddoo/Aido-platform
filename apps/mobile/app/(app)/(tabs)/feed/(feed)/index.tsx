import { ActivationChecklist } from '@src/features/activation/presentations/components/ActivationChecklist';
import { useActivationChecklist } from '@src/features/activation/presentations/hooks/use-activation-progress';
import { SuggestionEntry } from '@src/features/ai/presentations/components/SuggestionEntry';
import { FeatureDiscoveryReentryCard } from '@src/features/feature-discovery/presentations/components/FeatureDiscoveryReentryCard';
import { useFeatureDiscoveryFeed } from '@src/features/feature-discovery/presentations/hooks/use-feature-discovery-feed';
import { MarketingPushOptInBanner } from '@src/features/notification/presentations/components/MarketingPushOptInBanner';
import { MyCalendar } from '@src/features/todo/presentations/components/Calendar/MyCalendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedDateKey } from '@src/features/todo/presentations/hooks/use-feed-date';
import { WEATHER_QUERY_KEYS } from '@src/features/weather/presentations/constants/weather-query-keys.constant';
import { useWeatherIntroduction } from '@src/features/weather/presentations/hooks/use-weather-introduction';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { Box, QueryErrorBoundary, Spacing } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { RefreshControl } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

export default function MyFeedScreen() {
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  useWeatherIntroduction();
  const featureDiscovery = useFeatureDiscoveryFeed();
  const activation = useActivationChecklist();
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
      queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.all }),
    ]),
  );

  return (
    <NestableScrollContainer
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <MyCalendar />

      <Spacing size={10} />

      {activation.isVisible && (
        <>
          <Box px={16}>
            <ActivationChecklist progress={activation.progress} />
          </Box>
          <Spacing size={20} />
        </>
      )}

      <Box px={16} style={{ flexGrow: 1 }}>
        <QueryErrorBoundary
          resetKeys={[selectedDateKey]}
          fallback={(props) => <TodoList.Error {...props} />}
        >
          <Suspense fallback={<TodoList.Loading />}>
            <TodoList key={selectedDateKey} />
          </Suspense>
        </QueryErrorBoundary>
      </Box>

      <Spacing size={20} />

      {featureDiscovery.isReentryVisible && (
        <>
          <Box px={16}>
            <FeatureDiscoveryReentryCard onPress={featureDiscovery.openFromReentry} />
          </Box>
          <Spacing size={20} />
        </>
      )}

      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={null}>
          <MarketingPushOptInBanner />
        </Suspense>
      </QueryErrorBoundary>

      <Box px={16}>
        <QueryErrorBoundary>
          <Suspense fallback={<SuggestionEntry.Loading />}>
            <SuggestionEntry />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
      <Spacing size={20} />
    </NestableScrollContainer>
  );
}
