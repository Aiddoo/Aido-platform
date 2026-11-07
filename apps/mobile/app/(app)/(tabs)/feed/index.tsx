import { WhatsNewEntryCard } from '@src/features/app-config/whats-new/components/whats-new-entry-card';
import { useWhatsNewFeed } from '@src/features/app-config/whats-new/hooks/use-whats-new-feed';
import { SuggestionEntry } from '@src/features/assistant/suggestion/components/suggestion-entry';
import { ActivationChecklist } from '@src/features/device/activation/components/activation-checklist';
import { TodoCommentComposerBar } from '@src/features/engagement/comment/components/todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardArea } from '@src/features/engagement/comment/components/todo-comment-keyboard-area';
import { TodoCommentSession } from '@src/features/engagement/comment/components/todo-comment-session';
import { TodoCommentThreadList } from '@src/features/engagement/comment/components/todo-comment-thread-list';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { TodoDetailHeader } from '@src/features/engagement/comment/components/todo-detail-header';
import { TodoDetailSummary } from '@src/features/engagement/comment/components/todo-detail-summary';
import { useCommentParams } from '@src/features/engagement/comment/hooks/use-comment-params';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { MarketingPushOptInBanner } from '@src/features/notification/components/marketing-push-opt-in-banner';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { PushPermissionNotice } from '@src/features/notification/components/push-permission-notice';
import { useHasPendingNotificationEntry } from '@src/features/notification/hooks/use-notification-entry';
import { AddTodoRequestEntry } from '@src/features/planning/todo/components/add-todo-request-entry';
import { Calendar } from '@src/features/planning/todo/components/calendar/calendar';
import { FriendCalendar } from '@src/features/planning/todo/components/calendar/friend-calendar';
import { MyCalendar } from '@src/features/planning/todo/components/calendar/my-calendar';
import { FriendTodoList } from '@src/features/planning/todo/components/friend-todo-list';
import { TodoList } from '@src/features/planning/todo/components/todo-list/todo-list';
import {
  useFeedDateKey,
  useFeedFriendParam,
} from '@src/features/planning/todo/hooks/use-feed-params';
import {
  useFeedSelectedTodo,
  useFeedTodoDetailHandoff,
} from '@src/features/planning/todo/hooks/use-feed-selected-todo';
import { useIsTodoUnavailable } from '@src/features/planning/todo/hooks/use-is-todo-unavailable';
import { useTodoParams } from '@src/features/planning/todo/hooks/use-todo-params';
import {
  invalidateFeedTodos,
  invalidateFriendTodos,
} from '@src/features/planning/todo/queries/todo-cache';
import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { FriendStrip } from '@src/features/social/friend/components/friend-strip';
import { useScreenFriend } from '@src/features/social/friend/hooks/use-screen-friend';
import { InviteEntryBanner } from '@src/features/social/invite/components/invite-entry-banner';
import { useInviteAvailability } from '@src/features/social/invite/hooks/use-invite-availability';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { PokeBanner } from '@src/features/social/nudge/components/poke-banner';
import { RemindNudgeButton } from '@src/features/social/nudge/components/remind-nudge-button';
import { TodoNudgeButton } from '@src/features/social/nudge/components/todo-nudge-button';
import { TodoNudgePolicy } from '@src/features/social/nudge/domains/todo-nudge.model';
import { invalidateNudges } from '@src/features/social/nudge/queries/nudge-cache';
import { useWeatherIntroduction } from '@src/features/weather/hooks/use-weather-introduction';
import { invalidateWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useStableFeedForeground } from '@src/shared/hooks/use-stable-feed-foreground';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { KeyboardBottomGapProvider } from '@src/shared/providers/keyboard-bottom-gap-provider';
import {
  AdaptivePane,
  Box,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type PropsWithChildren, Suspense, useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { match, P } from 'ts-pattern';

export default function FeedScreen() {
  const [friendId] = useFeedFriendParam();
  const isInviteAvailable = useInviteAvailability();
  const openMyInvite = useOpenMyInvite();

  return (
    <>
      <NotificationBell.Toolbar />
      <AdaptivePane
        primary={
          <FeedListPane>
            <StyledSafeAreaView edges={['left', 'right']}>
              <QueryErrorBoundary fallback={FriendStrip.Error}>
                <Suspense fallback={<FriendStrip.Loading />}>
                  <FriendStrip
                    onInvite={
                      isInviteAvailable ? () => openMyInvite('friend_strip_empty') : undefined
                    }
                  />
                </Suspense>
              </QueryErrorBoundary>
            </StyledSafeAreaView>

            {match(friendId)
              .with(P.string, (id) => (
                <QueryErrorBoundary key={id} fallback={FriendFeedTodos.Error}>
                  <Suspense fallback={<FriendFeedTodos.Loading />}>
                    <FriendFeedTodos />
                  </Suspense>
                </QueryErrorBoundary>
              ))
              .with(undefined, () => <MyFeed />)
              .exhaustive()}
          </FeedListPane>
        }
        secondary={<FeedTodoDetailPane />}
      />
    </>
  );
}

function MyFeed() {
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  const status = useAuthStatus();
  const hasPendingNavigation = useHasPendingNotificationEntry();
  const isStable = useStableFeedForeground({
    isAuthenticated: status === 'authenticated',
    hasPendingNavigation,
  });
  const weatherIntroduction = useWeatherIntroduction({ isStable });
  const isInviteAvailable = useInviteAvailability();
  const whatsNew = useWhatsNewFeed({
    isStable,
    isWeatherIntroductionPending: weatherIntroduction.isPending,
    isInviteAvailable,
  });
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([invalidateFeedTodos(queryClient), invalidateWeather(queryClient)]),
  );

  return (
    <ScrollViewContainer
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <AddTodoRequestEntry />
        <MyCalendar />

        <Spacing size={10} />

        <ActivationChecklist className="mx-4 mb-5" />

        <Box px={16}>
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
              <WhatsNewEntryCard
                onPress={whatsNew.openFromReentry}
                onClose={whatsNew.dismissReentry}
              />
            </Box>
            <Spacing size={12} />
          </>
        )}

        {/* 조회해야 보일지 아는 안내 카드라 로딩·실패 때 자리를 잡지 않는다. 대부분 안 보여 자리를 잡으면 아래가 밀린다 */}
        <QueryErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <PushPermissionNotice className="mx-4 mb-3" />
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
        reset={() => fetchNextPage({ cancelRefetch: false }).catch(noop)}
      />
    ))
    .with({ friend: P.nullish, hasNextPage: true }, () => <FriendFeedTodos.Loading />)
    .with({ friend: P.nullish }, () => <MyFeedRedirect />)
    .with({ friend: P.nonNullable }, ({ friend }) => (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="grow"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          <FriendCalendar friendId={friend.id} />

          <Spacing size={8} />

          <Box px={16}>
            <QueryErrorBoundary fallback={PokeBanner.Error}>
              <Suspense fallback={<PokeBanner.Loading />}>
                <PokeBanner />
              </Suspense>
            </QueryErrorBoundary>
          </Box>

          <Spacing size={16} />

          <Box px={16} pb={24} className="grow">
            <QueryErrorBoundary
              resetKeys={[friend.id, selectedDateKey]}
              fallback={FriendTodoList.Error}
            >
              <Suspense fallback={<FriendTodoList.Loading />}>
                <FriendTodoList
                  key={selectedDateKey}
                  friendId={friend.id}
                  rowAction={FriendTodoNudgeAction}
                  emptyAction={FriendRemindNudgeAction}
                />
              </Suspense>
            </QueryErrorBoundary>
          </Box>
        </StyledSafeAreaView>
      </ScrollView>
    ))
    .exhaustive();
}

const COMPACT_ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

/** 친구 할 일 줄의 콕 버튼. 오늘의 끝나지 않은 할 일에만 보인다 */
function FriendTodoNudgeAction({ todo }: { todo: Todo }) {
  const { t } = useTranslation('friend');
  const { data: friend } = useScreenFriend();
  const selectedDateKey = useFeedDateKey();
  const todayKey = useTodayKey();
  const canNudgeTodo = TodoNudgePolicy.canNudgeTodoOnDate(
    { targetDateKey: selectedDateKey, isCompleted: todo.completed },
    todayKey,
  );

  if (!canNudgeTodo || friend == null) {
    return null;
  }

  return (
    <TodoNudgeButton
      receiver={{ ...friend, displayName: friend.name ?? t('fallbackName') }}
      todo={todo}
      className="min-h-0 py-1.5"
      hitSlop={COMPACT_ACTION_HIT_SLOP}
    />
  );
}

/** 오늘 할 일이 없는 친구에게 보내는 독촉 콕 버튼 */
function FriendRemindNudgeAction() {
  const { t } = useTranslation('friend');
  const { data: friend } = useScreenFriend();

  if (friend == null) {
    return null;
  }

  return (
    <RemindNudgeButton receiver={{ ...friend, displayName: friend.name ?? t('fallbackName') }} />
  );
}

FriendFeedTodos.Loading = function Loading() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1"
      contentContainerClassName="grow"
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <Calendar />

        <Spacing size={8} />

        <Box px={16}>
          <PokeBanner.Loading />
        </Box>

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
      className="flex-1"
      contentContainerClassName="grow"
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <Calendar />

        <Box px={16} pb={24} className="grow">
          <FriendTodoList.Error {...props} />
        </Box>
      </StyledSafeAreaView>
    </ScrollView>
  );
};

/** 더는 친구가 아닌 사람의 피드는 같은 화면의 내 피드로 돌린다. */
function MyFeedRedirect() {
  const [_friendId, selectFriend] = useFeedFriendParam();

  useEffect(() => {
    selectFriend(undefined);
  }, [selectFriend]);

  return null;
}

/** 피드 목록 칸. 접힌 화면으로 바뀌면 선택된 할 일과 댓글 위치를 상세 화면으로 넘긴다 */
function FeedListPane({ children }: PropsWithChildren) {
  useFeedTodoDetailHandoff();

  return (
    <Box flex={1} className="bg-white">
      {children}
    </Box>
  );
}

function FeedTodoDetailPane() {
  const [selectedTodoId, setSelectedTodoId] = useFeedSelectedTodo();
  const closeDetail = useCallback(() => setSelectedTodoId(undefined), [setSelectedTodoId]);

  if (selectedTodoId == null) {
    return (
      <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
        <TodoDetailSummary.Empty />
      </StyledSafeAreaView>
    );
  }

  return <FeedTodoDetail key={selectedTodoId} onClose={closeDetail} />;
}

/** 펼친 피드의 오른쪽 칸. 네이티브 헤더가 없어 제목 줄을 직접 두고, 뒤로가기는 선택만 푼다 */
function FeedTodoDetail({ onClose }: { onClose: () => void }) {
  const { todoId } = useTodoParams();
  const [{ sort, comment }] = useCommentParams();
  const date = useFeedDateKey();
  const isTodoUnavailable = useIsTodoUnavailable();

  return (
    <KeyboardBottomGapProvider>
      <StyledSafeAreaView
        edges={['left', 'right']}
        className="flex-1 bg-white"
        testID="todo-detail"
      >
        <TodoCommentSession onExit={onClose}>
          <TodoCommentTitleBar date={date} />

          {isTodoUnavailable ? (
            <TodoDetailSummary.Unavailable onClose={onClose} />
          ) : (
            <TodoCommentKeyboardArea>
              <QueryErrorBoundary
                resetKeys={[todoId, sort, comment]}
                fallback={(props) => (
                  <TodoCommentThreadList.Error {...props} header={<TodoDetailHeader />} />
                )}
              >
                <Suspense
                  fallback={<TodoCommentThreadList.Loading header={<TodoDetailHeader />} />}
                >
                  <TodoCommentThreadList header={<TodoDetailHeader />} />
                </Suspense>
              </QueryErrorBoundary>

              <QueryErrorBoundary resetKeys={[todoId]}>
                <TodoCommentComposerBar />
              </QueryErrorBoundary>
            </TodoCommentKeyboardArea>
          )}
        </TodoCommentSession>
      </StyledSafeAreaView>
    </KeyboardBottomGapProvider>
  );
}
