import { WhatsNewEntryNotice } from '@src/features/app-config/whats-new/components/whats-new-entry-notice';
import { useWhatsNewAutoOpen } from '@src/features/app-config/whats-new/hooks/use-whats-new-auto-open';
import { useWhatsNewFeed } from '@src/features/app-config/whats-new/hooks/use-whats-new-feed';
import { SuggestionEntry } from '@src/features/assistant/suggestion/components/suggestion-entry';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { ActivationChecklist } from '@src/features/device/activation/components/activation-checklist';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { TodoCommentPane } from '@src/features/engagement/comment/components/todo-comment-pane';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { TodoDetailSummary } from '@src/features/engagement/comment/components/todo-detail-summary';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { PushPermissionNotice } from '@src/features/notification/components/push-permission-notice';
import { useIsPushReminderOff } from '@src/features/notification/hooks/use-is-push-reminder-off';
import { useOpenPushOnboarding } from '@src/features/notification/hooks/use-open-push-onboarding';
import { useHasPendingPushNotificationEntry } from '@src/features/notification/hooks/use-push-notification-entry';
import { usePushOnboardingGuardState } from '@src/features/notification/hooks/use-push-onboarding-guard';
import { AddTodoRequestEntry } from '@src/features/planning/todo/components/add-todo-request-entry';
import { Calendar } from '@src/features/planning/todo/components/calendar/calendar';
import { FriendCalendar } from '@src/features/planning/todo/components/calendar/friend-calendar';
import { MyCalendar } from '@src/features/planning/todo/components/calendar/my-calendar';
import { RepeatHorizonHint } from '@src/features/planning/todo/components/calendar/repeat-horizon-hint';
import { FriendTodoList } from '@src/features/planning/todo/components/friend-todo-list';
import { TodoList } from '@src/features/planning/todo/components/todo-list';
import {
  useFeedDateKey,
  useFeedFriendId,
  useFeedSelectedTodoId,
} from '@src/features/planning/todo/hooks/use-feed-params';
import { useFeedTodoDetailHandoff } from '@src/features/planning/todo/hooks/use-feed-todo-detail-handoff';
import { useStableFeedForeground } from '@src/features/planning/todo/hooks/use-stable-feed-foreground';
import {
  refreshFeedTodos,
  refreshFriendTodos,
} from '@src/features/planning/todo/queries/todo-cache';
import { useGetFriendTodosQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { FriendStrip } from '@src/features/social/friend/components/friend-strip';
import type { FriendUser } from '@src/features/social/friend/domains/friend.model';
import {
  type RouteFriend,
  useSuspenseRouteFriend,
} from '@src/features/social/friend/hooks/use-suspense-route-friend';
import { useGetFriendsInfiniteQueryOptions } from '@src/features/social/friend/queries/friend.queries';
import { InviteEntryBanner } from '@src/features/social/invite/components/invite-entry-banner';
import { useIsInviteAvailable } from '@src/features/social/invite/hooks/use-is-invite-available';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { FriendRemindNudgeAction } from '@src/features/social/nudge/components/friend-remind-nudge-action';
import { FriendTodoNudgeAction } from '@src/features/social/nudge/components/friend-todo-nudge-action';
import { NudgeLimitBanner } from '@src/features/social/nudge/components/nudge-limit-banner';
import { useFriendTodoNudgeMenuAction } from '@src/features/social/nudge/hooks/use-friend-todo-nudge-menu-action';
import { refreshNudges } from '@src/features/social/nudge/queries/todo-nudge-cache';
import { refreshWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { KeyboardBottomGapProvider } from '@src/shared/providers/keyboard-bottom-gap-provider';
import {
  AdaptivePane,
  Box,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  SafeAreaScrollView,
  Spacing,
  StyledSafeAreaView,
  TintedRefreshControl,
} from '@src/shared/ui';
import { useInfiniteQuery, usePrefetchQuery, useQueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type ComponentProps, Fragment, Suspense, useEffect, useState } from 'react';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { match, P } from 'ts-pattern';

type FriendFeedView = Exclude<RouteFriend, { status: 'missing' }>;

export default function FeedScreen() {
  const [friendId] = useFeedFriendId();
  const [selectedTodoId, setSelectedTodoId] = useFeedSelectedTodoId();

  const isInviteAvailable = useIsInviteAvailable();

  // 피드를 내리기 시작하면 위에 떠 있는 친구 줄 안내가 내용을 가리지 않게 닫는다
  const [hasScrolledFeed, setHasScrolledFeed] = useState(false);

  const openMyInvite = useOpenMyInvite();
  const shouldShowCoachmarks = useShouldShowCoachmarks();
  const isFriendHintAhead = useIsFriendHintAhead({ hasScrolledFeed });

  // 펼친 화면에서 고른 할 일이 있는 채로 접히면 그 할 일과 댓글 위치를 상세 화면으로 넘긴다
  useFeedTodoDetailHandoff();

  const closeTodoDetail = () => setSelectedTodoId(undefined);

  return (
    <>
      <NotificationBellToolbar />
      <AdaptivePane
        primary={
          <Box flex={1} className="bg-white" testID="feed-screen">
            {/* 친구 줄은 세로 레일 밑까지 밀리고 내용만 레일을 피해 스스로 inset을 둔다 */}
            <QueryErrorBoundary fallback={FriendStrip.Error}>
              <Suspense fallback={<FriendStrip.Loading />}>
                <FriendStrip
                  empty={
                    <FriendStrip.Empty
                      onInvite={
                        isInviteAvailable ? () => openMyInvite('friend_strip_empty') : undefined
                      }
                      isHintDismissed={hasScrolledFeed}
                      shouldShowHint={shouldShowCoachmarks}
                    />
                  }
                />
              </Suspense>
            </QueryErrorBoundary>

            {match(friendId)
              .with(P.string, (id) => (
                <Fragment key={id}>
                  <FriendTodosPrefetch friendId={id} />
                  <QueryErrorBoundary fallback={FriendFeed.Error}>
                    <Suspense fallback={<FriendFeed.Loading />}>
                      <FriendFeed />
                    </Suspense>
                  </QueryErrorBoundary>
                </Fragment>
              ))
              .with(undefined, () => (
                <MyFeed
                  onScrollBeginDrag={() => setHasScrolledFeed(true)}
                  shouldShowHint={shouldShowCoachmarks}
                  shouldShowSuggestionHint={shouldShowCoachmarks && !isFriendHintAhead}
                />
              ))
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
                <TodoCommentPane
                  titleBar={<TodoCommentTitleBar />}
                  onClose={closeTodoDetail}
                  onExit={closeTodoDetail}
                />
              </StyledSafeAreaView>
            </KeyboardBottomGapProvider>
          ))
          .exhaustive()}
      />
    </>
  );
}

interface MyFeedProps extends Pick<
  ComponentProps<typeof ScrollViewContainer>,
  'onScrollBeginDrag'
> {
  /** 먼저 뜰 자동 화면(알림 화면·새로운 기능)이 남았으면 false라 말풍선을 미룬다 */
  shouldShowHint: boolean;
  /** 위의 친구 줄 안내가 남아 있으면 false라 AI 안내를 미룬다. 말풍선은 한 번에 하나다 */
  shouldShowSuggestionHint: boolean;
}

function MyFeed({ onScrollBeginDrag, shouldShowHint, shouldShowSuggestionHint }: MyFeedProps) {
  const [selectedDateKey] = useFeedDateKey();

  const queryClient = useQueryClient();
  const isReminderOff = useIsPushReminderOff();

  // 말풍선은 열 때 잰 자리에 머물러 피드가 움직이는 동안 AI 제안 입구 안내를 내렸다가 멈춘 자리에서 다시 잰다
  const [isScrolling, setIsScrolling] = useState(false);

  const whatsNew = useFirstFeedGuides();
  const [isRefreshing, handleRefresh] = useRefresh(() => {
    // 날씨는 위치부터 다시 읽어 늦을 수 있다. 당김 표시는 할 일만 기다리고 날씨 실패는 날씨 칸이 보인다
    refreshWeather(queryClient).catch(noop);
    return refreshFeedTodos(queryClient);
  });

  return (
    <ScrollViewContainer
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      onScrollBeginDrag={(event) => {
        setIsScrolling(true);
        onScrollBeginDrag?.(event);
      }}
      onScrollEndDrag={() => setIsScrolling(false)}
      onMomentumScrollBegin={() => setIsScrolling(true)}
      onMomentumScrollEnd={() => setIsScrolling(false)}
      refreshControl={<TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <AddTodoRequestEntry />
        <MyCalendar repeatHorizonHint={<RepeatHorizonHint shouldShowHint={shouldShowHint} />} />

        <Spacing size={12} />

        {/* 스스로 숨는 안내는 숨을 때 간격도 함께 사라지게 아래 12를 자기 className으로 가진다 */}
        <ActivationChecklist className="mx-4 mb-3" />

        <Box className="px-4">
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
        <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
          <Suspense fallback={null}>
            <PushPermissionNotice className="mx-4 mb-3" />
          </Suspense>
        </QueryErrorBoundary>

        <Box className="px-4">
          <QueryErrorBoundary fallback={SuggestionEntry.Error}>
            <Suspense fallback={<SuggestionEntry.Loading />}>
              <SuggestionEntry shouldShowHint={shouldShowSuggestionHint && !isScrolling} />
            </Suspense>
          </QueryErrorBoundary>
        </Box>

        <Spacing size={20} />
      </StyledSafeAreaView>
    </ScrollViewContainer>
  );
}

function FriendFeed() {
  const routeFriend = useSuspenseRouteFriend();

  return match(routeFriend)
    .with({ status: 'missing' }, () => <ReturnToMyFeed />)
    .with({ status: P.union('loading', 'error', 'ready') }, (view) => (
      <FriendFeed.Contents view={view} />
    ))
    .exhaustive();
}

/** 친구 피드 뼈대 하나. 친구를 읽는 동안·실패·다 읽은 뒤가 같은 자리에 그려져 상태가 바뀌어도 칸이 밀리지 않는다 */
FriendFeed.Contents = function Contents({ view }: { view: FriendFeedView }) {
  const [selectedDateKey] = useFeedDateKey();

  const queryClient = useQueryClient();

  // 콕 남은 횟수는 권한 스냅샷이 원본이라 함께 다시 받는다
  const [isRefreshing, handleRefresh] = useRefresh(() =>
    Promise.all([
      refreshFriendTodos(queryClient),
      refreshNudges(queryClient),
      invalidateEntitlements(queryClient),
    ]),
  );

  return (
    <SafeAreaScrollView
      className="flex-1"
      contentContainerClassName="grow"
      refreshControl={
        view.status === 'ready' ? (
          <TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
    >
      {/* 친구인지 확인한 뒤에만 친구의 달력을 받는다. 그 전에는 빈 달력이 같은 자리를 잡는다 */}
      {match(view)
        .with({ status: 'ready' }, () => <FriendCalendar />)
        .otherwise(() => (
          <Calendar />
        ))}

      <Spacing size={8} />

      {/* 콕 한도는 친구와 무관해 친구를 읽는 동안·실패해도 같은 자리에 스스로 그린다 */}
      <Box className="px-4">
        <QueryErrorBoundary fallback={NudgeLimitBanner.Error}>
          <Suspense fallback={<NudgeLimitBanner.Loading />}>
            <NudgeLimitBanner />
          </Suspense>
        </QueryErrorBoundary>
      </Box>

      <Spacing size={16} />

      <Box className="grow px-4 pb-6">
        {match(view)
          .with({ status: 'loading' }, () => <FriendTodoList.Loading />)
          .with({ status: 'error' }, ({ error, reset }) => (
            <FriendTodoList.Error error={error} reset={reset} />
          ))
          .with({ status: 'ready' }, ({ friend }) => (
            <QueryErrorBoundary
              resetKeys={[friend.id, selectedDateKey]}
              fallback={FriendTodoList.Error}
            >
              <Suspense fallback={<FriendTodoList.Loading />}>
                <FriendNudgeTodoList key={selectedDateKey} friend={friend} />
              </Suspense>
            </QueryErrorBoundary>
          ))
          .exhaustive()}
      </Box>
    </SafeAreaScrollView>
  );
};

FriendFeed.Loading = function Loading() {
  return <FriendFeed.Contents view={{ status: 'loading' }} />;
};

FriendFeed.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  return <FriendFeed.Contents view={{ status: 'error', error, reset }} />;
};

/** 콕 버튼·메뉴처럼 친구와 날짜가 필요한 행동을 피드가 한 번 읽어 목록에 넘긴다 */
function FriendNudgeTodoList({ friend }: { friend: FriendUser }) {
  const [selectedDateKey] = useFeedDateKey();
  const getNudgeMenuAction = useFriendTodoNudgeMenuAction({ friend, selectedDateKey });

  return (
    <FriendTodoList
      renderRowAction={(todo) => (
        <FriendTodoNudgeAction todo={todo} friend={friend} selectedDateKey={selectedDateKey} />
      )}
      findMenuAction={getNudgeMenuAction}
      emptyAction={<FriendRemindNudgeAction friend={friend} />}
    />
  );
}

/** 링크로 처음 연 친구 피드. 친구인지 확인하는 동안 그날 할 일을 함께 받아 확인 → 할 일 순서로 기다리지 않는다 */
function FriendTodosPrefetch({ friendId }: { friendId: string }) {
  const [selectedDateKey] = useFeedDateKey();

  usePrefetchQuery(
    useGetFriendTodosQueryOptions({ friendUserId: friendId, date: selectedDateKey }),
  );

  return null;
}

// <Redirect>는 피드 탭 첫 화면을 replace해 화면이 다시 마운트된다. 같은 화면에서 친구 선택만 지운다
function ReturnToMyFeed() {
  const [, selectFriend] = useFeedFriendId();

  useEffect(() => {
    selectFriend(undefined);
  }, [selectFriend]);

  return null;
}

/** 첫 피드는 알림 화면 → 새로운 기능 → 말풍선 순서라 앞 화면을 열지 정해진 뒤에만 말풍선을 띄운다 */
function useShouldShowCoachmarks(): boolean {
  const isPushOnboardingSettled = useIsPushOnboardingSettled();
  const { shouldShowCoachmarks } = useWhatsNewAutoOpen({
    isOnboardingSettled: isPushOnboardingSettled,
  });

  return shouldShowCoachmarks;
}

/** 말풍선은 한 번에 하나다. 친구가 없어 친구 줄 안내가 남았으면 그 안내를 닫거나 피드를 내린 뒤에 AI 개편 안내를 연다 */
function useIsFriendHintAhead({ hasScrolledFeed }: { hasScrolledFeed: boolean }): boolean {
  const [isFriendHintPending] = useMyPendingCoachmark('friend-strip');
  const { data: friends } = useInfiniteQuery(useGetFriendsInfiniteQueryOptions());

  return isFriendHintPending && !hasScrolledFeed && (friends?.items.length ?? 0) === 0;
}

/** 앱이 앞에 안정적으로 떠 있으면(로그인, 알림 이동 없음) 알림 켜기 화면을 열고, 그 화면이 정해진 뒤 새로운 기능 안내를 연다 */
function useFirstFeedGuides() {
  const authStatus = useAuthStatus();
  const hasPendingNavigation = useHasPendingPushNotificationEntry();
  const isPushOnboardingSettled = useIsPushOnboardingSettled();
  const isStable = useStableFeedForeground({ authStatus, hasPendingNavigation });

  useOpenPushOnboarding({ isStable });

  return useWhatsNewFeed({ isStable, isOnboardingSettled: isPushOnboardingSettled });
}

/** 알림 켜기 화면을 열지 정해졌고 열지 않는다. 그 뒤에야 다음 자동 화면(새 기능 안내·말풍선)을 연다 */
function useIsPushOnboardingSettled(): boolean {
  return usePushOnboardingGuardState() === 'closed';
}
