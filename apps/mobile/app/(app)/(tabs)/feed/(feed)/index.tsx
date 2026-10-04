import { dateSchema } from '@aido/validators';
import { ActivationChecklist } from '@src/features/activation/presentations/components/ActivationChecklist';
import { useActivationChecklist } from '@src/features/activation/presentations/hooks/use-activation-progress';
import { SuggestionEntry } from '@src/features/ai/presentations/components/SuggestionEntry';
import { FeatureDiscoveryReentryCard } from '@src/features/feature-discovery/presentations/components/FeatureDiscoveryReentryCard';
import { useFeatureDiscoveryFeed } from '@src/features/feature-discovery/presentations/hooks/use-feature-discovery-feed';
import { MarketingPushOptInBanner } from '@src/features/notification/presentations/components/MarketingPushOptInBanner';
import { AddTodoBottomSheet } from '@src/features/todo/presentations/components/AddTodoBottomSheet';
import { MyCalendar } from '@src/features/todo/presentations/components/Calendar/MyCalendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedDate, useFeedDateKey } from '@src/features/todo/presentations/hooks/use-feed-date';
import { FeedDateProvider } from '@src/features/todo/presentations/providers/feed-date-provider';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/get-todo-categories-query-options';
import { WEATHER_QUERY_KEYS } from '@src/features/weather/presentations/constants/weather-query-keys.constant';
import { useWeatherIntroduction } from '@src/features/weather/presentations/hooks/use-weather-introduction';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, Result, Spacing, Text, useOverlay } from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Suspense, useCallback, useEffect } from 'react';
import { RefreshControl } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { z } from 'zod';

const FeedSearchSchema = z.object({
  date: z
    .union([dateSchema, z.literal('today')])
    .optional()
    .catch(undefined),
  action: z.literal('add-todo').optional().catch(undefined),
});

export default function MyFeedPage() {
  const { date } = FeedSearchSchema.parse(useLocalSearchParams());
  const setDate = useCallback((value: string | undefined) => router.setParams({ date: value }), []);

  return (
    <FeedDateProvider date={date} onDateChange={setDate}>
      <MyFeedScreen />
    </FeedDateProvider>
  );
}

function MyFeedScreen() {
  const { t } = useTranslation(['widget', 'common']);
  const createEntry = useTodoCreateEntry();
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
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {createEntry.isLoading && (
        <Box px={16} py={8}>
          <Text size="b4" shade={6}>
            {t('widget:entry.loading')}
          </Text>
        </Box>
      )}
      {createEntry.isError && (
        <Box px={16} py={8}>
          <Result
            title={t('widget:entry.loadError')}
            button={
              <Result.Button
                onPress={() => {
                  void createEntry.refetch();
                }}
              >
                {t('common:actions.retry')}
              </Result.Button>
            }
          />
        </Box>
      )}
      {createEntry.isEmpty && (
        <Box px={16} py={8}>
          <Result
            title={t('widget:entry.emptyCategory')}
            button={
              <Result.Button
                onPress={() => {
                  router.setParams({ action: undefined });
                  router.navigate('/settings/category-settings');
                }}
              >
                {t('widget:entry.manageCategories')}
              </Result.Button>
            }
          />
        </Box>
      )}
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
        <QueryErrorBoundary fallback={(props) => <SuggestionEntry.Error {...props} />}>
          <Suspense fallback={<SuggestionEntry.Loading />}>
            <SuggestionEntry />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
      <Spacing size={20} />
    </NestableScrollContainer>
  );
}

function useTodoCreateEntry() {
  const { action } = FeedSearchSchema.parse(useLocalSearchParams());
  const [selectedDate] = useFeedDate();
  const overlay = useOverlay();
  const isRequested = action === 'add-todo';
  const categories = useQuery({
    ...useGetTodoCategoriesQueryOptions(),
    enabled: isRequested,
    throwOnError: false,
  });
  const categoryId = categories.data?.categories[0]?.id;

  useEffect(() => {
    if (!isRequested || categoryId == null) return;
    const frameId = requestAnimationFrame(() => {
      router.setParams({ action: undefined });
      void overlay.open(({ isOpen, close, exit }) => (
        <AddTodoBottomSheet
          mode="create"
          selectedDate={selectedDate}
          categoryId={categoryId}
          isOpen={isOpen}
          onClose={close}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              close();
              exit();
            }
          }}
        />
      ));
    });
    return () => cancelAnimationFrame(frameId);
  }, [isRequested, categoryId, selectedDate, overlay]);

  return {
    isLoading: categories.isLoading,
    isError: isRequested && categories.isError,
    isEmpty: isRequested && categories.isSuccess && categoryId == null,
    refetch: categories.refetch,
  };
}
