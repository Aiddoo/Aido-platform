import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedCalendar } from '@src/features/todo/presentations/providers/feed-calendar-provider';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useCallback } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

const MyFeedScreen = () => {
  const { selectedDate } = useFeedCalendar();
  const queryClient = useQueryClient();
  const invalidateTodos = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
      ]),
    [queryClient],
  );
  const [refreshing, onRefresh] = useRefresh(invalidateTodos);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Calendar />

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
