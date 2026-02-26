import { getFriendsQueryOptions } from '@src/features/friend/presentations/queries/get-friends-query-options';
import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { FriendTodoList } from '@src/features/todo/presentations/components/FriendTodoList';
import { PokeBanner } from '@src/features/todo/presentations/components/PokeBanner';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedCalendar } from '@src/features/todo/presentations/providers/feed-calendar-provider';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense, useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

const FriendFeedScreen = () => {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { selectedDate } = useFeedCalendar();
  const queryClient = useQueryClient();
  const invalidateTodos = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() }),
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudges() }),
      ]),
    [queryClient],
  );
  const [refreshing, onRefresh] = useRefresh(invalidateTodos);

  const { data: friendsData } = useSuspenseInfiniteQuery(getFriendsQueryOptions());

  const friend = useMemo(
    () => friendsData.pages.flatMap((p) => p.items).find((f) => f.id === friendId),
    [friendsData.pages, friendId],
  );

  if (!friend) return <Redirect href="/feed" />;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Calendar showCompletions={false} />

      <Spacing size={8} />

      <QueryErrorBoundary>
        <Suspense fallback={<PokeBanner.Loading />}>
          <PokeBanner />
        </Suspense>
        <Spacing size={16} />
        <Suspense fallback={<FriendTodoList.Loading />}>
          <FriendTodoList friend={friend} date={selectedDate} />
        </Suspense>
      </QueryErrorBoundary>
    </ScrollView>
  );
};

export default FriendFeedScreen;
