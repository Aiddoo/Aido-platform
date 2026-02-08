import { Box } from '@src/shared/ui/Box/Box';

import { formatDate } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';
import { InView } from 'react-native-intersection-observer';
import type { TodoItemViewModel } from '../../queries/get-todos-infinite-query-options';
import { getTodosInfiniteQueryOptions } from '../../queries/get-todos-infinite-query-options';
import { TodoItem } from './TodoItem';

interface CategoryTodoListProps {
  date: Date;
  categoryId: number;
}

export function CategoryTodoList({ date, categoryId }: CategoryTodoListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    getTodosInfiniteQueryOptions(formatDate(date), categoryId),
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Box>
      {data.todos.map((todo: TodoItemViewModel) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
      {hasNextPage && !isFetchingNextPage && (
        <InView triggerOnce onChange={(inView) => inView && handleLoadMore()}>
          <Box />
        </InView>
      )}
      {isFetchingNextPage && (
        <Box className="py-2 items-center">
          <ActivityIndicator />
        </Box>
      )}
    </Box>
  );
}
