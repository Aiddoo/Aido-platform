import { dateSchema, userIdParamSchema } from '@aido/api';
import { useFriendById } from '@src/features/friend/hooks/use-friend-by-id';
import { Calendar } from '@src/features/todo/components/calendar/calendar';
import { FriendCalendar } from '@src/features/todo/components/calendar/friend-calendar';
import { FriendTodoList } from '@src/features/todo/components/friend-todo-list';
import { PokeBanner } from '@src/features/todo/components/poke-banner';
import { FeedDateProvider } from '@src/features/todo/components/providers/feed-date-provider';
import { TODO_QUERY_KEYS } from '@src/features/todo/constants/todo-query-keys';
import { useFeedDateKey } from '@src/features/todo/hooks/use-feed-date';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { Box, QueryErrorBoundary, Spacing, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense, useCallback } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { z } from 'zod';

const FriendFeedSearchSchema = z.object({
  date: z
    .union([dateSchema, z.literal('today')])
    .optional()
    .catch(undefined),
});

export default function FriendFeedScreen() {
  const params = useLocalSearchParams();
  const { friendId } = params;
  const { date } = FriendFeedSearchSchema.parse(params);
  const setDate = useCallback((value: string | undefined) => router.setParams({ date: value }), []);
  const parsed = userIdParamSchema.shape.userId.safeParse(friendId);
  if (!parsed.success) {
    return <Redirect href="/feed" />;
  }
  return (
    <FeedDateProvider date={date} onDateChange={setDate}>
      <QueryErrorBoundary
        resetKeys={[parsed.data]}
        fallback={(props) => <FriendFeedContent.Error {...props} />}
      >
        <Suspense fallback={<FriendFeedContent.Loading />}>
          <FriendFeedContent />
        </Suspense>
      </QueryErrorBoundary>
    </FeedDateProvider>
  );
}

function FriendFeedContent() {
  const { friendId: rawFriendId } = useLocalSearchParams();
  const friendId = userIdParamSchema.shape.userId.parse(rawFriendId);
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  const { friend, hasNextPage, isFetchNextPageError, error, fetchNextPage } =
    useFriendById(friendId);
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudges() }),
    ]),
  );

  if (!friend && isFetchNextPageError) {
    return (
      <FriendFeedContent.Error
        error={error}
        reset={() => {
          fetchNextPage({ cancelRefetch: false }).catch(() => undefined);
        }}
      />
    );
  }
  if (!friend && hasNextPage) {
    return <FriendFeedContent.Loading />;
  }
  if (!friend) {
    return <Redirect href="/feed" />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <FriendCalendar friendUserId={friend.id} />

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
            <FriendTodoList key={selectedDateKey} friend={friend} />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
    </ScrollView>
  );
}

FriendFeedContent.Loading = function Loading() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Calendar />
      <Spacing size={16} />
      <Box px={16}>
        <FriendTodoList.Loading />
      </Box>
    </ScrollView>
  );
};
FriendFeedContent.Error = function ErrorState(props: QueryErrorFallbackProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Calendar />
      <Box px={16} pb={24} style={{ flexGrow: 1 }}>
        <FriendTodoList.Error {...props} />
      </Box>
    </ScrollView>
  );
};
