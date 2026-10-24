import { friendScreenParamsSchema } from '@src/features/friend/hooks/use-friend-screen-params';
import { useScreenFriend } from '@src/features/friend/hooks/use-screen-friend';
import { PokeBanner } from '@src/features/nudge/components/poke-banner';
import { invalidateNudges } from '@src/features/nudge/queries/nudge-cache';
import { Calendar } from '@src/features/todo/components/calendar/calendar';
import { FriendCalendar } from '@src/features/todo/components/calendar/friend-calendar';
import { FriendTodoList } from '@src/features/todo/components/friend-todo-list';
import { FeedDateProvider } from '@src/features/todo/components/providers/feed-date-provider';
import { useFeedDateKey } from '@src/features/todo/hooks/use-feed-date';
import { useFeedDateParam } from '@src/features/todo/hooks/use-feed-date-param';
import { invalidateFriendTodos } from '@src/features/todo/queries/todo-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import {
  Box,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match, P } from 'ts-pattern';

function FriendFeedScreen() {
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
      <FriendFeedScreen.Error
        error={error}
        reset={() => fetchNextPage({ cancelRefetch: false }).catch(() => undefined)}
      />
    ))
    .with({ friend: P.nullish, hasNextPage: true }, () => <FriendFeedScreen.Loading />)
    .with({ friend: P.nullish }, () => <Redirect href="/feed" />)
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

FriendFeedScreen.Loading = function Loading() {
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
FriendFeedScreen.Error = function ErrorState(props: QueryErrorFallbackProps) {
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

export default function FriendFeedRoute() {
  const params = useLocalSearchParams();
  const [date, setDate] = useFeedDateParam();
  const parsed = friendScreenParamsSchema.safeParse(params);
  if (!parsed.success) {
    return <Redirect href="/feed" />;
  }
  return (
    <FeedDateProvider date={date} onDateChange={setDate}>
      <QueryErrorBoundary
        resetKeys={[parsed.data.friendId]}
        fallback={(props) => <FriendFeedScreen.Error {...props} />}
      >
        <Suspense fallback={<FriendFeedScreen.Loading />}>
          <FriendFeedScreen />
        </Suspense>
      </QueryErrorBoundary>
    </FeedDateProvider>
  );
}
