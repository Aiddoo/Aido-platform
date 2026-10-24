import { ActivationChecklist } from '@src/features/activation/components/activation-checklist';
import { useActivationChecklist } from '@src/features/activation/hooks/use-activation-progress';
import { SuggestionEntry } from '@src/features/ai/components/suggestion-entry';
import { FeatureDiscoveryReentryCard } from '@src/features/feature-discovery/components/feature-discovery-reentry-card';
import { useFeatureDiscoveryFeed } from '@src/features/feature-discovery/hooks/use-feature-discovery-feed';
import { MarketingPushOptInBanner } from '@src/features/notification/components/marketing-push-opt-in-banner';
import { AddTodoBottomSheet } from '@src/features/todo/components/add-todo-bottom-sheet';
import { MyCalendar } from '@src/features/todo/components/calendar/my-calendar';
import { FeedDateProvider } from '@src/features/todo/components/providers/feed-date-provider';
import { TodoList } from '@src/features/todo/components/todo-list/todo-list';
import { useFeedActionParam } from '@src/features/todo/hooks/use-feed-action-param';
import { useFeedDate, useFeedDateKey } from '@src/features/todo/hooks/use-feed-date';
import { useFeedDateParam } from '@src/features/todo/hooks/use-feed-date-param';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { invalidateFeedTodos } from '@src/features/todo/queries/todo-cache';
import { useWeatherIntroduction } from '@src/features/weather/hooks/use-weather-introduction';
import { invalidateWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  QueryErrorBoundary,
  Result,
  Spacing,
  StyledSafeAreaView,
  Text,
  useOverlay,
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { RefreshControl } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { match } from 'ts-pattern';

function MyFeedScreen() {
  const { t } = useTranslation(['widget', 'common']);
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  useWeatherIntroduction();
  const featureDiscovery = useFeatureDiscoveryFeed();
  const activation = useActivationChecklist();
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([invalidateFeedTodos(queryClient), invalidateWeather(queryClient)]),
  );

  const [action, setAction] = useFeedActionParam();
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
    if (!isRequested || categoryId == null) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      setAction(undefined);
      overlay.open(({ isOpen, close, exit }) => (
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
  }, [isRequested, categoryId, selectedDate, overlay, setAction]);

  const createEntryStatus = !isRequested
    ? ('idle' as const)
    : match(categories)
        .with({ isLoading: true }, () => 'loading' as const)
        .with({ isError: true }, () => 'error' as const)
        .with({ isSuccess: true }, () =>
          categoryId == null ? ('empty' as const) : ('idle' as const),
        )
        .otherwise(() => 'idle' as const);

  return (
    <NestableScrollContainer
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        {match(createEntryStatus)
          .with('loading', () => (
            <Box px={16} py={8}>
              <Text size="b4" shade={6}>
                {t('widget:entry.loading')}
              </Text>
            </Box>
          ))
          .with('error', () => (
            <Box px={16} py={8}>
              <Result
                title={t('widget:entry.loadError')}
                button={
                  <Result.Button onPress={() => categories.refetch()}>
                    {t('common:actions.retry')}
                  </Result.Button>
                }
              />
            </Box>
          ))
          .with('empty', () => (
            <Box px={16} py={8}>
              <Result
                title={t('widget:entry.emptyCategory')}
                button={
                  <Result.Button
                    onPress={() => {
                      setAction(undefined);
                      router.navigate('/settings/category-settings');
                    }}
                  >
                    {t('widget:entry.manageCategories')}
                  </Result.Button>
                }
              />
            </Box>
          ))
          .with('idle', () => null)
          .exhaustive()}
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
      </StyledSafeAreaView>
    </NestableScrollContainer>
  );
}

export default function MyFeedRoute() {
  const [date, setDate] = useFeedDateParam();

  return (
    <FeedDateProvider date={date} onDateChange={setDate}>
      <MyFeedScreen />
    </FeedDateProvider>
  );
}
