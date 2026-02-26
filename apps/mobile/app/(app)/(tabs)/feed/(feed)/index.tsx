import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedDate } from '@src/features/todo/presentations/providers/feed-date-provider';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useCallback } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

const MyFeedScreen = () => {
  const { selectedDate, setSelectedDate } = useFeedDate();
  const queryClient = useQueryClient();
  const invalidateTodos = useCallback(
    () => queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all }),
    [queryClient],
  );
  const [refreshing, onRefresh] = useRefresh(invalidateTodos);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Calendar value={selectedDate} onChange={setSelectedDate} showCompletions />

      <Spacing size={8} />

      <QueryErrorBoundary>
        <Suspense fallback={<TodoList.Loading />}>
          <TodoList date={selectedDate} />
        </Suspense>
      </QueryErrorBoundary>
    </ScrollView>
  );
};

export default MyFeedScreen;
