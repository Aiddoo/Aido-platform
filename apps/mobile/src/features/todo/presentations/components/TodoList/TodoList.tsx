import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { PlusIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { groupBy } from 'es-toolkit';
import times from 'es-toolkit/compat/times';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useDraggableReorderList } from '../../hooks/use-draggable-reorder-list';
import { getAllTodosQueryOptions } from '../../queries/get-all-todos-query-options';
import { getTodoCategoriesQueryOptions } from '../../queries/get-todo-categories-query-options';
import { reorderTodoMutationOptions } from '../../queries/reorder-todo-mutation-options';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { TodoItem } from './TodoItem';

interface TodoCategoryViewModel {
  id: number;
  name: string;
  color: string;
}

interface TodoListProps {
  date: Date;
}

export function TodoList({ date }: TodoListProps) {
  const formattedDate = formatDate(date);
  const { data, dataUpdatedAt } = useSuspenseQuery(getAllTodosQueryOptions(formattedDate));
  const { data: categoriesData } = useSuspenseQuery({
    ...getTodoCategoriesQueryOptions(),
    select: (data) => ({
      categories: data.categories.map(
        (c): TodoCategoryViewModel => ({ id: c.id, name: c.name, color: c.color }),
      ),
    }),
  });

  const categoryGroups = useMemo(() => {
    const grouped = groupBy(data.todos, (todo) => todo.category.id);

    return categoriesData.categories.map((category) => ({
      category,
      todos: grouped[category.id] ?? [],
    }));
  }, [data.todos, categoriesData.categories]);

  return (
    <Box gap={16} px={16}>
      {categoryGroups.map((group) => (
        <Box key={group.category.id} gap={8}>
          <CategoryHeader date={date} category={group.category} />
          <CategoryTodoDraggableList todos={group.todos} updatedAt={dataUpdatedAt} />
        </Box>
      ))}
    </Box>
  );
}

interface CategoryHeaderProps {
  date: Date;
  category: TodoCategoryViewModel;
}

function CategoryHeader({ date, category }: CategoryHeaderProps) {
  const overlay = useOverlay();

  return (
    <PressableFeedback
      onPress={() => {
        overlay.open(({ isOpen, close, exit }) => (
          <AddTodoBottomSheet
            mode="create"
            selectedDate={date}
            categoryId={category.id}
            isOpen={isOpen}
            onRequestClose={close}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
          />
        ));
      }}
      hitSlop={8}
      className="self-start flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-2"
    >
      <Text size="b3" weight="semibold" style={{ color: category.color }}>
        {category.name}
      </Text>
      <PlusIcon width={14} height={14} colorClassName="text-gray-6" />
    </PressableFeedback>
  );
}

interface CategoryTodoDraggableListProps {
  todos: TodoItemViewModel[];
  updatedAt: number;
}

function CategoryTodoDraggableList({ todos, updatedAt }: CategoryTodoDraggableListProps) {
  const reorderMutation = useMutation(reorderTodoMutationOptions());

  const { items: draggableTodos, onDragEnd } = useDraggableReorderList({
    items: todos,
    updatedAt,
    isPending: reorderMutation.isPending,
    onReorder: ({ movedItemId, targetId, position }) => {
      reorderMutation.mutate({
        id: movedItemId,
        input: { targetTodoId: targetId, position },
      });
    },
  });

  return (
    <DraggableFlatList
      data={draggableTodos}
      keyExtractor={(item) => String(item.id)}
      scrollEnabled={false}
      renderItem={({ item, drag, isActive }) => (
        <ScaleDecorator activeScale={1.015}>
          <TodoItem
            todo={item}
            drag={drag}
            isActive={isActive}
            isDragDisabled={reorderMutation.isPending}
          />
        </ScaleDecorator>
      )}
      onDragEnd={onDragEnd}
    />
  );
}

TodoList.Loading = function Loading() {
  return (
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
};
