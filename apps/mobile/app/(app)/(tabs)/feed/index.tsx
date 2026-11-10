import { WhatsNewEntryNotice } from '@src/features/app-config/whats-new/components/whats-new-entry-notice';
import { useWhatsNewFeed } from '@src/features/app-config/whats-new/hooks/use-whats-new-feed';
import { SuggestionEntry } from '@src/features/assistant/suggestion/components/suggestion-entry';
import { ActivationChecklist } from '@src/features/device/activation/components/activation-checklist';
import { TodoCommentComposerBar } from '@src/features/engagement/comment/components/todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardArea } from '@src/features/engagement/comment/components/todo-comment-keyboard-area';
import { TodoCommentSession } from '@src/features/engagement/comment/components/todo-comment-session';
import { TodoCommentThreadList } from '@src/features/engagement/comment/components/todo-comment-thread-list';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { TodoDetailSummary } from '@src/features/engagement/comment/components/todo-detail-summary';
import { useTodoCommentParams } from '@src/features/engagement/comment/hooks/use-todo-comment-params';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { PushPermissionNotice } from '@src/features/notification/components/push-permission-notice';
import { useIsPushReminderOff } from '@src/features/notification/hooks/use-is-push-reminder-off';
import { useHasPendingNotificationEntry } from '@src/features/notification/hooks/use-notification-entry';
import { useOpenPushOnboarding } from '@src/features/notification/hooks/use-open-push-onboarding';
import { useIsPushOnboardingGuardClosed } from '@src/features/notification/hooks/use-push-onboarding-guard';
import { AddTodoRequestEntry } from '@src/features/planning/todo/components/add-todo-request-entry';
import { Calendar } from '@src/features/planning/todo/components/calendar/calendar';
import { FriendCalendar } from '@src/features/planning/todo/components/calendar/friend-calendar';
import { MyCalendar } from '@src/features/planning/todo/components/calendar/my-calendar';
import { FriendTodoList } from '@src/features/planning/todo/components/friend-todo-list';
import { TodoAvailabilityGuard } from '@src/features/planning/todo/components/todo-availability-guard';
import { TodoList } from '@src/features/planning/todo/components/todo-list/todo-list';
import { useFeedDateKey, useFeedFriendId } from '@src/features/planning/todo/hooks/use-feed-params';
import {
  useFeedSelectedTodoId,
  useFeedTodoDetailHandoff,
} from '@src/features/planning/todo/hooks/use-feed-selected-todo-id';
import { useStableFeedForeground } from '@src/features/planning/todo/hooks/use-stable-feed-foreground';
import {
  invalidateFeedTodos,
  invalidateFriendTodos,
} from '@src/features/planning/todo/queries/todo-cache';
import { FriendStrip } from '@src/features/social/friend/components/friend-strip';
import { useRouteFriendQuery } from '@src/features/social/friend/hooks/use-route-friend-query';
import { InviteEntryBanner } from '@src/features/social/invite/components/invite-entry-banner';
import { useIsInviteAvailable } from '@src/features/social/invite/hooks/use-is-invite-available';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { FriendRemindNudgeAction } from '@src/features/social/nudge/components/friend-remind-nudge-action';
import { FriendTodoNudgeAction } from '@src/features/social/nudge/components/friend-todo-nudge-action';
import { NudgeLimitBanner } from '@src/features/social/nudge/components/nudge-limit-banner';
import { invalidateNudges } from '@src/features/social/nudge/queries/todo-nudge-cache';
import { invalidateWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
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
import { type ComponentProps, Suspense, useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { match, P } from 'ts-pattern';

/** 친구 피드 위 쿡 찌르기 안내 줄의 높이(그림 72). 불러오는 동안과 실패했을 때 같은 자리를 잡는다 */
const NUDGE_BANNER_HEIGHT = 72;

export default function FeedScreen() {
  const [friendId] = useFeedFriendId();
  const [selectedTodoId, setSelectedTodoId] = useFeedSelectedTodoId();
  const [{ sort, comment }] = useTodoCommentParams();
  const isInviteAvailable = useIsInviteAvailable();
  const openMyInvite = useOpenMyInvite();
  const closeDetail = useCallback(() => setSelectedTodoId(undefined), [setSelectedTodoId]);
  // 피드를 내리기 시작하면 위에 떠 있는 친구 줄 안내가 내용을 가리지 않게 닫는다
  const [hasScrolledFeed, setHasScrolledFeed] = useState(false);

  useFeedTodoDetailHandoff();

  return (
    <>
      <NotificationBellToolbar />
      <AdaptivePane
        primary={
          <Box flex={1} className="bg-white">
            {/* 친구 줄은 세로 레일 밑까지 밀리고 내용만 레일을 피해 스스로 inset을 둔다 */}
            <QueryErrorBoundary fallback={FriendStrip.Error}>
              <Suspense fallback={<FriendStrip.Loading />}>
                <FriendStrip
                  onInvite={
                    isInviteAvailable ? () => openMyInvite('friend_strip_empty') : undefined
                  }
                  isHintDismissed={hasScrolledFeed}
                />
              </Suspense>
            </QueryErrorBoundary>

            {match(friendId)
              .with(P.string, (id) => (
                <QueryErrorBoundary key={id} fallback={FriendFeedTodos.Error}>
                  <Suspense fallback={<FriendFeedTodos.Loading />}>
                    <FriendFeedTodos />
                  </Suspense>
                </QueryErrorBoundary>
              ))
              .with(undefined, () => <MyFeed onScrollBeginDrag={() => setHasScrolledFeed(true)} />)
              .exhaustive()}
          </Box>
        }
        secondary={match(selectedTodoId)
          .with(undefined, () => (
            <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
              <TodoDetailSummary.Empty />
            </StyledSafeAreaView>
          ))
          .with(P.number, (id) => (
            <KeyboardBottomGapProvider key={id}>
              <StyledSafeAreaView
                edges={['left', 'right']}
                className="flex-1 bg-white"
                testID="todo-detail"
              >
                {/* 펼친 피드의 오른쪽 칸이라 네이티브 헤더가 없어 제목 줄을 직접 두고, 뒤로가기는 선택만 푼다 */}
                <TodoCommentSession onExit={closeDetail}>
                  <TodoCommentTitleBar />

                  <TodoAvailabilityGuard
                    fallback={<TodoDetailSummary.Unavailable onClose={closeDetail} />}
                  >
                    <TodoCommentKeyboardArea>
                      <QueryErrorBoundary
                        resetKeys={[id, sort, comment]}
                        fallback={TodoCommentThreadList.Error}
                      >
                        <Suspense fallback={<TodoCommentThreadList.Loading />}>
                          <TodoCommentThreadList />
                        </Suspense>
                      </QueryErrorBoundary>

                      <QueryErrorBoundary resetKeys={[id]}>
                        <Suspense fallback={<TodoCommentComposerBar.Loading />}>
                          <TodoCommentComposerBar />
                        </Suspense>
                      </QueryErrorBoundary>
                    </TodoCommentKeyboardArea>
                  </TodoAvailabilityGuard>
                </TodoCommentSession>
              </StyledSafeAreaView>
            </KeyboardBottomGapProvider>
          ))
          .exhaustive()}
      />
    </>
  );
}

function MyFeed({
  onScrollBeginDrag,
}: Pick<ComponentProps<typeof ScrollViewContainer>, 'onScrollBeginDrag'>) {
  const [selectedDateKey] = useFeedDateKey();
  const queryClient = useQueryClient();
  const status = useAuthStatus();
  const hasPendingNavigation = useHasPendingNotificationEntry();
  const isStable = useStableFeedForeground({
    isAuthenticated: status === 'authenticated',
    hasPendingNavigation,
  });
  useOpenPushOnboarding({ isStable });
  const isPushOnboardingSettled = useIsPushOnboardingGuardClosed();
  const isReminderOff = useIsPushReminderOff();
  const whatsNew = useWhatsNewFeed({ isStable, isOnboardingSettled: isPushOnboardingSettled });
  const [isRefreshing, handleRefresh] = useRefresh(() =>
    Promise.all([invalidateFeedTodos(queryClient), invalidateWeather(queryClient)]),
  );

  return (
    <ScrollViewContainer
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      onScrollBeginDrag={onScrollBeginDrag}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <AddTodoRequestEntry />
        <MyCalendar />

        <Spacing size={12} />

        {/* 스스로 숨는 안내는 숨을 때 간격도 함께 사라지게 아래 12를 자기 className으로 가진다 */}
        <ActivationChecklist className="mx-4 mb-3" />

        <Box px={16}>
          <QueryErrorBoundary resetKeys={[selectedDateKey]} fallback={TodoList.Error}>
            <Suspense fallback={<TodoList.Loading />}>
              <TodoList key={selectedDateKey} isReminderOff={isReminderOff} />
            </Suspense>
          </QueryErrorBoundary>
        </Box>

        <Spacing size={20} />

        <InviteEntryBanner className="mx-4 mb-3" />

        {whatsNew.isReentryVisible && (
          <WhatsNewEntryNotice
            className="mx-4 mb-3"
            onPress={whatsNew.openFromReentry}
            onClose={whatsNew.dismissReentry}
          />
        )}

        {/* 조회해야 보일지 아는 안내 카드라 로딩·실패 때 자리를 잡지 않는다. 대부분 안 보여 자리를 잡으면 아래가 밀린다 */}
        <QueryErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <PushPermissionNotice className="mx-4 mb-3" />
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
  const [selectedDateKey] = useFeedDateKey();
  const queryClient = useQueryClient();
  const {
    data: friend,
    hasNextPage,
    isFetchNextPageError,
    error,
    fetchNextPage,
  } = useRouteFriendQuery();
  const [isRefreshing, handleRefresh] = useRefresh(() =>
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
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          <FriendCalendar friendId={friend.id} />

          <Spacing size={8} />

          <Box px={16}>
            <QueryErrorBoundary fallback={NudgeLimitBanner.Error}>
              <Suspense fallback={<NudgeLimitBanner.Loading />}>
                <NudgeLimitBanner />
              </Suspense>
            </QueryErrorBoundary>
          </Box>

          <Spacing size={16} />

          <Box className="grow px-4 pb-6">
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
          <NudgeLimitBanner.Loading />
        </Box>

        <Spacing size={16} />

        <Box px={16}>
          <FriendTodoList.Loading />
        </Box>
      </StyledSafeAreaView>
    </ScrollView>
  );
};

FriendFeedTodos.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1"
      contentContainerClassName="grow"
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow">
        <Calendar />

        <Spacing size={8} />

        {/* 불러오기 전과 같은 높이로 안내 줄 자리를 비워 둬 오류 뒤 목록이 밀리지 않는다 */}
        <Box className="px-4" style={{ height: NUDGE_BANNER_HEIGHT }} />

        <Spacing size={16} />

        <Box className="grow px-4 pb-6">
          <FriendTodoList.Error {...props} />
        </Box>
      </StyledSafeAreaView>
    </ScrollView>
  );
};

function MyFeedRedirect() {
  const [_friendId, selectFriend] = useFeedFriendId();

  useEffect(() => {
    selectFriend(undefined);
  }, [selectFriend]);

  return null;
}
