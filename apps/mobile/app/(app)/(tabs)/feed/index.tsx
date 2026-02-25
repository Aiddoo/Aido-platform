import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { FriendTodoList } from '@src/features/todo/presentations/components/FriendTodoList';
import { PokeBanner } from '@src/features/todo/presentations/components/PokeBanner';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import type { SelectedUser } from '@src/features/todo/presentations/components/UserAvatarList';
import { UserAvatarList } from '@src/features/todo/presentations/components/UserAvatarList';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useToday } from '@src/shared/hooks/useToday';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

const FeedScreen = () => {
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedUser, setSelectedUser] = useState<SelectedUser>({ type: 'me' });
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
    setRefreshing(false);
  }, [queryClient]);

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <VStack>
        <QueryErrorBoundary>
          <Suspense fallback={<UserAvatarList.Loading />}>
            <UserAvatarList value={selectedUser} onChange={setSelectedUser} />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Calendar
          value={selectedDate}
          onChange={setSelectedDate}
          showCompletions={selectedUser.type === 'me'}
        />

        <Spacing size={8} />

        <QueryErrorBoundary>
          {match(selectedUser)
            .with({ type: 'me' }, () => (
              <Suspense fallback={<TodoList.Loading />}>
                <TodoList date={selectedDate} />
              </Suspense>
            ))
            .with({ type: 'friend' }, (friend) => (
              <>
                <Suspense fallback={<PokeBanner.Loading />}>
                  <PokeBanner />
                </Suspense>
                <Spacing size={16} />
                <Suspense fallback={<FriendTodoList.Loading />}>
                  <FriendTodoList friend={friend} date={selectedDate} />
                </Suspense>
              </>
            ))
            .exhaustive()}
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default FeedScreen;
