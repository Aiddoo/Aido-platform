import { ActivationChecklist } from '@src/features/activation/components/activation-checklist';
import { SuggestionEntry } from '@src/features/ai/components/suggestion-entry';
import { FeatureDiscoveryReentryCard } from '@src/features/feature-discovery/components/feature-discovery-reentry-card';
import { useFeatureDiscoveryFeed } from '@src/features/feature-discovery/hooks/use-feature-discovery-feed';
import { useScreenFriend } from '@src/features/friend/hooks/use-screen-friend';
import { InviteEntryBanner } from '@src/features/invite/components/invite-entry-banner';
import { MarketingPushOptInBanner } from '@src/features/notification/components/marketing-push-opt-in-banner';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { PokeBanner } from '@src/features/nudge/components/poke-banner';
import { invalidateNudges } from '@src/features/nudge/queries/nudge-cache';
import { Calendar } from '@src/features/todo/components/calendar/calendar';
import { FriendCalendar } from '@src/features/todo/components/calendar/friend-calendar';
import { MyCalendar } from '@src/features/todo/components/calendar/my-calendar';
import { FeedListPane } from '@src/features/todo/components/feed-list-pane';
import { FeedTodoDetailPane } from '@src/features/todo/components/feed-todo-detail-pane';
import { FriendTodoList } from '@src/features/todo/components/friend-todo-list';
import { CalendarProvider } from '@src/features/todo/components/providers/calendar-provider';
import { FeedDateProvider } from '@src/features/todo/components/providers/feed-date-provider';
import { TodoList } from '@src/features/todo/components/todo-list/todo-list';
import { useFeedActionParam } from '@src/features/todo/hooks/use-feed-action-param';
import { useFeedDateKey } from '@src/features/todo/hooks/use-feed-date';
import { useFeedDateParam } from '@src/features/todo/hooks/use-feed-date-param';
import { useFeedFriendIdParam } from '@src/features/todo/hooks/use-feed-friend-id-param';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { invalidateFeedTodos, invalidateFriendTodos } from '@src/features/todo/queries/todo-cache';
import { todoCreateSheetHref } from '@src/features/todo/utils/navigation/todo-sheet-href';
import { useWeatherIntroduction } from '@src/features/weather/hooks/use-weather-introduction';
import { invalidateWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  AdaptivePane,
  Box,
  QueryErrorBoundary,
  Result,
  Spacing,
  StyledSafeAreaView,
  Text,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { match, P } from 'ts-pattern';

export default function FeedScreen() {
  const [date, setDate] = useFeedDateParam();
  const [friendId] = useFeedFriendIdParam();

  return (
    <CalendarProvider>
      <NotificationBell.Toolbar />
      <FeedDateProvider date={date} onDateChange={setDate}>
        <AdaptivePane
          primary={
            <FeedListPane>
              {match(friendId)
                .with(P.string, (id) => <FriendFeed key={id} />)
                .with(undefined, () => <MyFeed />)
                .exhaustive()}
            </FeedListPane>
          }
          secondary={<FeedTodoDetailPane />}
        />
      </FeedDateProvider>
    </CalendarProvider>
  );
}

function MyFeed() {
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  useWeatherIntroduction();
  const featureDiscovery = useFeatureDiscoveryFeed();
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([invalidateFeedTodos(queryClient), invalidateWeather(queryClient)]),
  );

  return (
    <ScrollViewContainer
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <AddTodoRequestEntry />
        <MyCalendar />

        <Spacing size={10} />

        <ActivationChecklist className="mx-4 mb-5" />

        <Box px={16} style={{ flexGrow: 1 }}>
          <QueryErrorBoundary resetKeys={[selectedDateKey]} fallback={TodoList.Error}>
            <Suspense fallback={<TodoList.Loading />}>
              <TodoList key={selectedDateKey} />
            </Suspense>
          </QueryErrorBoundary>
        </Box>

        <Spacing size={20} />

        <InviteEntryBanner className="mx-4 mb-5" />

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
          <QueryErrorBoundary fallback={SuggestionEntry.Error}>
            <Suspense fallback={<SuggestionEntry.Loading />}>
              <SuggestionEntry />
            </Suspense>
          </QueryErrorBoundary>
        </Box>
        <Spacing size={20} />
      </StyledSafeAreaView>
    </ScrollViewContainer>
  );
}

/** 위젯·딥링크의 할 일 추가 요청을 받아 기본 카테고리로 추가 시트를 연다. */
function AddTodoRequestEntry() {
  const { t } = useTranslation(['widget', 'common']);
  const [action, setAction] = useFeedActionParam();
  const selectedDateKey = useFeedDateKey();
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
      router.push(todoCreateSheetHref({ date: selectedDateKey, categoryId }));
    });
    return () => cancelAnimationFrame(frameId);
  }, [isRequested, categoryId, selectedDateKey, setAction]);

  const createEntryStatus = !isRequested
    ? ('idle' as const)
    : match(categories)
        .with({ isLoading: true }, () => 'loading' as const)
        .with({ isError: true }, () => 'error' as const)
        .with({ isSuccess: true }, () =>
          categoryId == null ? ('empty' as const) : ('idle' as const),
        )
        .otherwise(() => 'idle' as const);

  return match(createEntryStatus)
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
    .exhaustive();
}

function FriendFeed() {
  return (
    <QueryErrorBoundary fallback={(props) => <FriendFeedTodos.Error {...props} />}>
      <Suspense fallback={<FriendFeedTodos.Loading />}>
        <FriendFeedTodos />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function FriendFeedTodos() {
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  const {
    data: friend,
    hasNextPage,
    isFetchNextPageError,
    error,
    fetchNextPage,
  } = useScreenFriend();
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([invalidateFriendTodos(queryClient), invalidateNudges(queryClient)]),
  );

  return match({ friend, isFetchNextPageError, hasNextPage })
    .with({ friend: P.nullish, isFetchNextPageError: true }, () => (
      <FriendFeedTodos.Error
        error={error}
        reset={() => fetchNextPage({ cancelRefetch: false }).catch(() => undefined)}
      />
    ))
    .with({ friend: P.nullish, hasNextPage: true }, () => <FriendFeedTodos.Loading />)
    .with({ friend: P.nullish }, () => <MyFeedRedirect />)
    .with({ friend: P.nonNullable }, ({ friend }) => (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          <FriendCalendar />

          <Spacing size={8} />

          <QueryErrorBoundary fallback={(props) => <PokeBanner.Error {...props} />}>
            <Suspense fallback={<PokeBanner.Loading />}>
              <PokeBanner />
            </Suspense>
          </QueryErrorBoundary>

          <Spacing size={16} />

          <Box px={16} pb={24} style={{ flexGrow: 1 }}>
            <QueryErrorBoundary
              resetKeys={[friend.id, selectedDateKey]}
              fallback={(props) => <FriendTodoList.Error {...props} />}
            >
              <Suspense fallback={<FriendTodoList.Loading />}>
                <FriendTodoList key={selectedDateKey} />
              </Suspense>
            </QueryErrorBoundary>
          </Box>
        </StyledSafeAreaView>
      </ScrollView>
    ))
    .exhaustive();
}

FriendFeedTodos.Loading = function Loading() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <Calendar />
        <Spacing size={16} />
        <Box px={16}>
          <FriendTodoList.Loading />
        </Box>
      </StyledSafeAreaView>
    </ScrollView>
  );
};

FriendFeedTodos.Error = function ErrorState(props: QueryErrorFallbackProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <Calendar />
        <Box px={16} pb={24} style={{ flexGrow: 1 }}>
          <FriendTodoList.Error {...props} />
        </Box>
      </StyledSafeAreaView>
    </ScrollView>
  );
};

/** 더는 친구가 아닌 사람의 피드는 같은 화면의 내 피드로 돌린다. */
function MyFeedRedirect() {
  const [_friendId, setFriendId] = useFeedFriendIdParam();

  useEffect(() => {
    setFriendId(undefined);
  }, [setFriendId]);

  return null;
}
