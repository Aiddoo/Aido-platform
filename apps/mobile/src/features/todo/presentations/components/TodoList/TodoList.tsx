import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { Box, HStack, PlusIcon, Text, useOverlay, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatDate } from '@src/shared/utils/date';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { Checkbox, PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
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

interface TodoListItemProps {
  left?: ReactNode;
  top: ReactNode;
  middle?: ReactNode;
  bottom?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
  children?: ReactNode;
}

TodoList.Item = function Item({
  left,
  top,
  middle,
  bottom,
  right,
  onPress,
  onLongPress,
  isActive,
  isDisabled,
  children,
}: TodoListItemProps) {
  return (
    <>
      <PressableFeedback
        onPress={onPress}
        onLongPress={onLongPress}
        isDisabled={isActive || isDisabled || (!onPress && !onLongPress)}
        className={cn('py-2 rounded-xl', isActive && 'bg-gray-1', isDisabled && 'opacity-50')}
      >
        <HStack gap={12} align="center">
          {left}
          <VStack flex={1} gap={2}>
            {top}
            {middle}
            {bottom}
          </VStack>
          {right}
        </HStack>
      </PressableFeedback>
      {children}
    </>
  );
};

interface TodoListCheckboxProps
  extends Omit<ComponentProps<typeof Checkbox>, 'isSelected' | 'onSelectedChange' | 'className'> {
  isChecked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

TodoList.Checkbox = function TodoCheckbox({
  isChecked,
  onCheckedChange,
  isDisabled,
  ...props
}: TodoListCheckboxProps) {
  return (
    <Checkbox
      className="shadow-none border border-main size-5 rounded-md"
      isSelected={isChecked}
      onSelectedChange={onCheckedChange ? () => onCheckedChange(!isChecked) : undefined}
      isDisabled={isDisabled || !onCheckedChange}
      {...props}
    />
  );
};

interface TodoListLabelProps
  extends Omit<
    ComponentProps<typeof Text>,
    'size' | 'weight' | 'strikethrough' | 'shade' | 'children'
  > {
  isChecked: boolean;
  children: string;
}

TodoList.Label = function TodoLabel({ isChecked, children, ...props }: TodoListLabelProps) {
  return (
    <Text
      size="b3"
      weight="medium"
      strikethrough={isChecked}
      shade={isChecked ? 5 : undefined}
      {...props}
    >
      {children}
    </Text>
  );
};

TodoList.Progress = function Progress({ value, total }: { value: number; total: number }) {
  return (
    <HStack gap={6} align="center">
      <Box className="h-1 w-10 rounded-full bg-gray-2 overflow-hidden">
        <Box
          className="h-full rounded-full bg-main"
          style={{ width: `${(value / total) * 100}%` }}
        />
      </Box>
      <Text size="e1" shade={6}>
        {value}/{total}
      </Text>
    </HStack>
  );
};

TodoList.Error = function ErrorFallback({ reset }: { error: unknown; reset: () => void }) {
  return (
    <Box px={16} py={24} gap={8} className="items-center">
      <Text size="b3" shade={8}>
        할 일을 불러오는 중에 오류가 발생했습니다.
      </Text>

      <PressableFeedback onPress={reset}>
        <Text size="b4" tone="brand">
          재시도
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
