import { SuggestionEntry } from '@src/features/ai/components/suggestion-entry';
import { WhatsNewReentryCard } from '@src/features/app-config/whats-new/components/whats-new-reentry-card';
import { useWhatsNewFeed } from '@src/features/app-config/whats-new/hooks/use-whats-new-feed';
import { ActivationChecklist } from '@src/features/device/activation/components/activation-checklist';
import { MarketingPushOptInBanner } from '@src/features/notification/components/marketing-push-opt-in-banner';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { PushPermissionCard } from '@src/features/notification/components/push-permission-card';
import { Calendar } from '@src/features/planning/todo/components/calendar/calendar';
import { FriendCalendar } from '@src/features/planning/todo/components/calendar/friend-calendar';
import { MyCalendar } from '@src/features/planning/todo/components/calendar/my-calendar';
import { FeedListPane } from '@src/features/planning/todo/components/feed-list-pane';
import { FeedTodoDetailPane } from '@src/features/planning/todo/components/feed-todo-detail-pane';
import { FriendStrip } from '@src/features/planning/todo/components/friend-strip';
import { FriendTodoList } from '@src/features/planning/todo/components/friend-todo-list';
import { FeedDateProvider } from '@src/features/planning/todo/components/providers/feed-date-provider';
import { TodoList } from '@src/features/planning/todo/components/todo-list/todo-list';
import { useFeedActionParam } from '@src/features/planning/todo/hooks/use-feed-action-param';
import { useFeedDateKey } from '@src/features/planning/todo/hooks/use-feed-date';
import { useFeedDateParam } from '@src/features/planning/todo/hooks/use-feed-date-param';
import { useFeedFriendIdParam } from '@src/features/planning/todo/hooks/use-feed-friend-id-param';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/todo/queries/get-todo-categories-query-options';
import {
  invalidateFeedTodos,
  invalidateFriendTodos,
} from '@src/features/planning/todo/queries/todo-cache';
import { todoCreateSheetHref } from '@src/features/planning/todo/utils/navigation/todo-sheet-href';
import { useScreenFriend } from '@src/features/social/friend/hooks/use-screen-friend';
import { InviteEntryBanner } from '@src/features/social/invite/components/invite-entry-banner';
import { PokeBanner } from '@src/features/social/nudge/components/poke-banner';
import { invalidateNudges } from '@src/features/social/nudge/queries/nudge-cache';
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
    <>
      <NotificationBell.Toolbar />
      <FeedDateProvider date={date} onDateChange={setDate}>
        <AdaptivePane
          primary={
            <FeedListPane>
              <StyledSafeAreaView edges={['left', 'right']}>
                <QueryErrorBoundary fallback={FriendStrip.Error}>
                  <Suspense fallback={<FriendStrip.Loading />}>
                    <FriendStrip />
                  </Suspense>
                </QueryErrorBoundary>
              </StyledSafeAreaView>
              {match(friendId)
                .with(P.string, (id) => <FriendFeed key={id} />)
                .with(undefined, () => <MyFeed />)
                .exhaustive()}
            </FeedListPane>
          }
          secondary={<FeedTodoDetailPane />}
        />
      </FeedDateProvider>
    </>
  );
}

function MyFeed() {
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  const weatherIntroduction = useWeatherIntroduction();
  const whatsNew = useWhatsNewFeed({
    isWeatherIntroductionPending: weatherIntroduction.isPending,
  });
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

        {whatsNew.isReentryVisible && (
          <>
            <Box px={16}>
              <WhatsNewReentryCard
                onPress={whatsNew.openFromReentry}
                onDismiss={whatsNew.dismissReentry}
              />
            </Box>
            <Spacing size={12} />
          </>
        )}

        {/* 조회해야 보일지 아는 안내 카드라 로딩·실패 때 자리를 잡지 않는다. 대부분 안 보여 자리를 잡으면 아래가 밀린다 */}
        <QueryErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <PushPermissionCard className="mx-4 mb-3" />
            <MarketingPushOptInBanner className="mx-4 mb-3" />
          </Suspense>
        </QueryErrorBoundary>

        <Box px={16}>
          <QueryErrorBoundary fallback={SuggestionEntry.Error}>
            <SuggestionEntry />
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
    <QueryErrorBoundary fallback={FriendFeedTodos.Error}>
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

          <QueryErrorBoundary fallback={PokeBanner.Error}>
            <Suspense fallback={<PokeBanner.Loading />}>
              <PokeBanner />
            </Suspense>
          </QueryErrorBoundary>

          <Spacing size={16} />

          <Box px={16} pb={24} style={{ flexGrow: 1 }}>
            <QueryErrorBoundary
              resetKeys={[friend.id, selectedDateKey]}
              fallback={FriendTodoList.Error}
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
