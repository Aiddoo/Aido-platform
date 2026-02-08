import { Box } from '@src/shared/ui/Box/Box';

import { formatDate } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import type { TodoItemViewModel } from '../../queries/get-todos-infinite-query-options';
import { getTodosInfiniteQueryOptions } from '../../queries/get-todos-infinite-query-options';
import { TodoItem } from './TodoItem';

const VISIBILITY_CHECK_INTERVAL_MS = 300;

interface InViewTriggerProps {
  onVisible: () => void;
}

function InViewTrigger({ onVisible }: InViewTriggerProps) {
  const ref = useRef<View>(null);
  const onVisibleRef = useRef(onVisible);

  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const windowHeight = Dimensions.get('window').height;

    const interval = setInterval(() => {
      ref.current?.measureInWindow((_x, y, _width, _height) => {
        if (y >= 0 && y < windowHeight) {
          onVisibleRef.current();
        }
      });
    }, VISIBILITY_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return <View ref={ref} />;
}

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
      {hasNextPage && !isFetchingNextPage && <InViewTrigger onVisible={handleLoadMore} />}
      {isFetchingNextPage && (
        <Box className="py-2 items-center">
          <ActivityIndicator />
        </Box>
      )}
    </Box>
  );
}
