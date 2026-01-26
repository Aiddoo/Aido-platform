import { FlashList } from '@shopify/flash-list';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { DocsIcon } from '@src/shared/ui/Icon';
import { Result } from '@src/shared/ui/Result/Result';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton } from 'heroui-native';
import { ActivityIndicator } from 'react-native';
import { getTodosInfiniteQueryOptions } from '../../queries/get-todos-infinite-query-options';
import { TodoItem } from './TodoItem';

interface TodoListProps {
  date: Date;
}

const TodoListComponent = ({ date }: TodoListProps) => {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    getTodosInfiniteQueryOptions(formatDate(date)),
  );

  return (
    <FlashList
      data={data.todos}
      renderItem={({ item }) => <TodoItem todo={item} />}
      keyExtractor={(item) => String(item.id)}
      ListFooterComponent={
        isFetchingNextPage ? (
          <VStack py={16} align="center">
            <ActivityIndicator />
          </VStack>
        ) : null
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
      ListEmptyComponent={
        <Flex flex={1} justify="center" align="center">
          <Result icon={<DocsIcon width={72} height={72} />} title="할 일이 없어요" />
        </Flex>
      }
    />
  );
};

const TodoListLoading = () => (
  <VStack px={16} gap={12}>
    {times(5, (i) => (
      <HStack key={`todo-skeleton-${i}`} gap={12} align="center" className="py-3">
        <Skeleton className="size-5 rounded" />
        <VStack flex={1} gap={2}>
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </VStack>
      </HStack>
    ))}
  </VStack>
);

export const TodoList = Object.assign(TodoListComponent, {
  Loading: TodoListLoading,
});
