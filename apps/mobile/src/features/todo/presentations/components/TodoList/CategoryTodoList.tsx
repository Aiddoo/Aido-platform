import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';

import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';
import { InView } from 'react-native-intersection-observer';
import { useGetTodosInfiniteQueryOptions } from '../../queries/use-get-todos-infinite-query-options';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { TodoItem } from './TodoItem';

interface CategoryTodoListProps {
  date: Date;
  categoryId: number;
}

export function CategoryTodoList({ date, categoryId }: CategoryTodoListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    useGetTodosInfiniteQueryOptions(formatDate(date), categoryId),
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

CategoryTodoList.Loading = function Loading() {
  return (
    <VStack gap={8}>
      {times(2, (i) => (
        <HStack key={`cat-todo-skeleton-${i}`} gap={12} align="center" className="py-3">
          <Box className="size-5 rounded bg-gray-3" />
          <VStack flex={1} gap={2}>
            <Box className="h-5 w-3/4 rounded bg-gray-3" />
            <Box className="h-4 w-16 rounded bg-gray-3" />
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
};
