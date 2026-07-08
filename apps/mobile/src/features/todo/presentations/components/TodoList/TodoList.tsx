import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, PlusIcon, Text, useOverlay, VStack } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { NestableDraggableFlatList, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useDraggableReorderList } from '../../hooks/use-draggable-reorder-list';
import { useFeedDate } from '../../hooks/use-feed-date';
import { useGetTodoCategoriesQueryOptions } from '../../queries/use-get-todo-categories-query-options';
import { useGetTodosByCategoryQueryOptions } from '../../queries/use-get-todos-by-category-query-options';
import { useReorderTodoMutationOptions } from '../../queries/use-reorder-todo-mutation-options';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { TodoItem } from './TodoItem';

export function TodoList() {
  const [selectedDate] = useFeedDate();
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const { data: categoriesData } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const { data: categoryGroups } = useSuspenseQuery(
    useGetTodosByCategoryQueryOptions(
      formatDate(selectedDate),
      preference.timeFormat,
      categoriesData.categories,
    ),
  );

  return (
    <Box gap={16} px={16}>
      {categoryGroups.map((group) => (
        <Box key={group.category.id} gap={8}>
          <CategoryHeader
            label={group.category.name}
            color={group.category.color}
            categoryId={group.category.id}
          />

          <TodoDraggableList items={group.todos} />
        </Box>
      ))}
    </Box>
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

TodoList.Error = function ErrorFallback({ reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation(['todo', 'common']);
  return (
    <Box px={16} py={24} gap={8} className="items-center">
      <Text size="b3" shade={8}>
        {t('list.loadError')}
      </Text>

      <PressableFeedback onPress={reset}>
        <Text size="b4" tone="brand">
          {t('common:errorBoundary.retry')}
        </Text>
      </PressableFeedback>
    </Box>
  );
};

interface CategoryHeaderProps {
  label: string;
  color: string;
  categoryId: number;
}

function CategoryHeader({ label, color, categoryId }: CategoryHeaderProps) {
  const [selectedDate] = useFeedDate();
  const overlay = useOverlay();

  return (
    <PressableFeedback
      onPress={() => {
        overlay.open(({ isOpen, close, exit }) => (
          <AddTodoBottomSheet
            mode="create"
            selectedDate={selectedDate}
            categoryId={categoryId}
            isOpen={isOpen}
            onClose={close}
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
      <Text size="b4" weight="semibold" style={{ color }}>
        {label}
      </Text>

      <PlusIcon
        width={fontScaledSize(14)}
        height={fontScaledSize(14)}
        colorClassName="text-gray-8"
      />
    </PressableFeedback>
  );
}

interface TodoDraggableListProps {
  items: TodoItemViewModel[];
}

function TodoDraggableList({ items }: TodoDraggableListProps) {
  const reorderMutation = useMutation(useReorderTodoMutationOptions());

  const { items: draggableItems, onDragEnd } = useDraggableReorderList({
    items,
    isPending: reorderMutation.isPending,
    onReorder: ({ movedItemId, targetId, position }) => {
      reorderMutation.mutate({
        id: movedItemId,
        input: { targetTodoId: targetId, position },
      });
    },
  });

  return (
    <NestableDraggableFlatList
      data={draggableItems}
      keyExtractor={(item) => String(item.id)}
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
