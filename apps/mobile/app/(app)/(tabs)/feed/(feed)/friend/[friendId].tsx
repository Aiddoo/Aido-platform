import { userIdParamSchema } from '@aido/validators';
import { useFriendById } from '@src/features/friend/presentations/hooks/use-friend-by-id';
import { FriendCalendar } from '@src/features/todo/presentations/components/Calendar/FriendCalendar';
import { FriendTodoList } from '@src/features/todo/presentations/components/FriendTodoList';
import { PokeBanner } from '@src/features/todo/presentations/components/PokeBanner';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedDateKey } from '@src/features/todo/presentations/hooks/use-feed-date';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { Box, QueryErrorBoundary, Spacing } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

export default function FriendFeedScreen() {
  const { friendId } = useLocalSearchParams();
  const parsed = userIdParamSchema.shape.userId.safeParse(friendId);
  if (!parsed.success) return <Redirect href="/feed" />;
  return <FriendFeedContent />;
}

function FriendFeedContent() {
  const { friendId: rawFriendId } = useLocalSearchParams();
  const friendId = userIdParamSchema.shape.userId.parse(rawFriendId);
  const selectedDateKey = useFeedDateKey();
  const queryClient = useQueryClient();
  const friend = useFriendById(friendId);
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudges() }),
    ]),
  );

  if (!friend) return <Redirect href="/feed" />;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <FriendCalendar friendUserId={friend.id} />

      <Spacing size={8} />

      <QueryErrorBoundary>
        <Suspense fallback={<PokeBanner.Loading />}>
          <PokeBanner />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={16} />

      <Box px={16}>
        <QueryErrorBoundary resetKeys={[selectedDateKey]}>
          <Suspense fallback={<FriendTodoList.Loading />}>
            <FriendTodoList key={selectedDateKey} friend={friend} />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
    </ScrollView>
  );
}
