import type { TodoCategoryWithCount } from '@src/features/todo/models/todo-category.model';
import { getTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/get-todo-categories-query-options';
import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { PlusIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { Suspense } from 'react';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { CategoryTodoList } from './CategoryTodoList';

interface TodoListProps {
  date: Date;
}

export function TodoList({ date }: TodoListProps) {
  const { data: categoriesData } = useSuspenseQuery(getTodoCategoriesQueryOptions());

  return (
    <Box gap={24} px={16}>
      {categoriesData.categories.map((category) => (
        <Box key={category.id} gap={8}>
          <CategoryHeader date={date} category={category} />
          <QueryErrorBoundary>
            <Suspense fallback={<CategoryTodoList.Loading />}>
              <CategoryTodoList date={date} categoryId={category.id} />
            </Suspense>
          </QueryErrorBoundary>
        </Box>
      ))}
    </Box>
  );
}

interface CategoryHeaderProps {
  date: Date;
  category: TodoCategoryWithCount;
}

function CategoryHeader({ date, category }: CategoryHeaderProps) {
  const overlay = useOverlay();

  return (
    <PressableFeedback
      onPress={() => {
        overlay.open(({ isOpen, close, exit }) => (
          <AddTodoBottomSheet
            selectedDate={date}
            categoryId={category.id}
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
          />
        ));
      }}
      className="self-start flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-2"
    >
      <Text size="b4" weight="semibold" style={{ color: category.color }}>
        {category.name}
      </Text>
      <PlusIcon width={14} height={14} colorClassName="text-gray-6" />
    </PressableFeedback>
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
