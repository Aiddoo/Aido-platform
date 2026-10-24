import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { type SubTodo, SubTodoPolicy } from '@src/features/todo/domains/sub-todo.model';
import { type Todo, TodoPolicy } from '@src/features/todo/domains/todo.model';
import { formatTodoTime } from '@src/features/todo/utils/format-todo-time';
import { useDraggableReorderList } from '@src/shared/hooks/use-draggable-reorder-list';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  PlusIcon,
  Result,
  Text,
  type QueryErrorFallbackProps,
  ChatBubbleIcon,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconCountButton,
  LockIcon,
  MoreIcon,
} from '@src/shared/ui';
import { formatDate, getDateFormatContext } from '@src/shared/utils/date';
import { useMutation, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useMemo, useState } from 'react';
import {
  type DragEndParams,
  NestableDraggableFlatList,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';

import { useFeedDate, useFeedDateKey } from '../../hooks/use-feed-date';
import { useFeedSelectedTodo } from '../../hooks/use-feed-selected-todo';
import { useGetTodoCategoriesQueryOptions } from '../../queries/get-todo-categories-query-options';
import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useReorderSubTodosMutationOptions } from '../../queries/use-reorder-sub-todos-mutation-options';
import { useReorderTodoMutationOptions } from '../../queries/use-reorder-todo-mutation-options';
import { useToggleSubTodoMutationOptions } from '../../queries/use-toggle-sub-todo-mutation-options';
import { useToggleTodoMutationOptions } from '../../queries/use-toggle-todo-mutation-options';
import { toTodoCategoryGroups } from '../../utils/group-todos-by-category';
import {
  subTodoCreateSheetHref,
  subTodoActionsSheetHref,
  todoActionsSheetHref,
  todoCreateSheetHref,
} from '../../utils/navigation/todo-sheet-href';
import { CategoryHeaderPill } from '../category-header-pill';
import { ReorderCoachmark } from '../reorder-coachmark';
import { SubTodoList } from '../sub-todo-list/sub-todo-list';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from '../todo-row';

export function TodoList() {
  const [selectedDate] = useFeedDate();
  const [{ data: categoriesResult }, { data: todosByDate, dataUpdatedAt }] = useSuspenseQueries({
    queries: [
      useGetTodoCategoriesQueryOptions(),
      useGetTodosByDateQueryOptions({ date: formatDate(selectedDate) }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const categoryGroups = useMemo(
    () => toTodoCategoryGroups(todosByDate.todos, categoriesResult.categories),
    [todosByDate.todos, categoriesResult.categories],
  );
  const canReorderTodos = categoryGroups.some((group) => group.todos.length >= 2);

  return (
    <Box gap={16}>
      {canReorderTodos && <ReorderCoachmark kind="todo" />}
      {categoryGroups.map((group) => (
        <Box key={group.category.id} gap={8}>
          <CategoryHeader
            label={group.category.name}
            color={group.category.color}
            categoryId={group.category.id}
          />

          <TodoDraggableList items={group.todos} updatedAt={dataUpdatedAt} />
        </Box>
      ))}
    </Box>
  );
}

TodoList.Loading = function Loading() {
  return (
    <Box gap={8}>
      <CategoryHeaderPill.Loading />
      <Box>
        {times(5, (index) => (
          <TodoRow.Loading key={index} />
        ))}
      </Box>
    </Box>
  );
};

TodoList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  return (
    <Result
      title={t('list.loadError')}
      button={<Result.Button onPress={reset}>{t('common:errorBoundary.retry')}</Result.Button>}
    />
  );
};

interface CategoryHeaderProps {
  label: string;
  color: string;
  categoryId: number;
}

function CategoryHeader({ label, color, categoryId }: CategoryHeaderProps) {
  const fontScaledSize = useFontScaledSize();
  const date = useFeedDateKey();
  const push = useSingleTap(router.push);

  return (
    <PressableFeedback
      onPress={() => push(todoCreateSheetHref({ date, categoryId }))}
      hitSlop={8}
      className="self-start"
    >
      <CategoryHeaderPill label={label} color={color}>
        <PlusIcon
          width={fontScaledSize(14)}
          height={fontScaledSize(14)}
          colorClassName="text-gray-8"
        />
      </CategoryHeaderPill>
    </PressableFeedback>
  );
}

interface TodoDraggableListProps {
  items: Todo[];
  updatedAt: number;
}

function TodoDraggableList({ items, updatedAt }: TodoDraggableListProps) {
  const reorderMutation = useMutation(useReorderTodoMutationOptions());

  const {
    items: draggableItems,
    onDragBegin,
    onDragEnd,
  } = useDraggableReorderList({
    items,
    updatedAt,
    isPending: reorderMutation.isPending,
    getItemId: (todo) => todo.id,
    onReorder: ({ movedId, targetId, position }) => {
      reorderMutation.mutate({
        id: movedId,
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
          <TodoList.Item
            todo={item}
            drag={drag}
            isActive={isActive}
            isDragDisabled={reorderMutation.isPending}
          />
        </ScaleDecorator>
      )}
      onDragBegin={onDragBegin}
      onDragEnd={onDragEnd}
    />
  );
}

interface TodoListItemProps {
  todo: Todo;
  drag?: () => void;
  isActive?: boolean;
  isDragDisabled?: boolean;
}

TodoList.Item = function Item({ todo, drag, isActive, isDragDisabled }: TodoListItemProps) {
  const [_selectedTodoId, setSelectedTodoId] = useFeedSelectedTodo();
  const selectTodo = useSingleTap(setSelectedTodoId);

  const { t } = useTranslation('todo');
  const date = useFeedDateKey();
  const push = useSingleTap(router.push);
  const toggleTodo = useMutation(useToggleTodoMutationOptions());
  const toggleSubTodo = useMutation(useToggleSubTodoMutationOptions());
  const reorderSubTodos = useMutation(useReorderSubTodosMutationOptions());
  const [isExpanded, setIsExpanded] = useState(TodoPolicy.hasSubTodos(todo));
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const formattedTime = formatTodoTime(todo, preference.timeFormat, getDateFormatContext());
  const isOptimistic = 'optimistic' in todo && todo.optimistic === true;

  const handleRowPress = () => setIsExpanded((current) => !current);

  const handleCommentsPress = () => selectTodo(todo.id);

  const handleActionsPress = () => push(todoActionsSheetHref({ todoId: todo.id, date }));

  const handleAddSubTodoPress = () => push(subTodoCreateSheetHref({ todoId: todo.id, date }));

  const handleSubTodoMorePress = (subTodo: SubTodo) =>
    push(subTodoActionsSheetHref({ todoId: todo.id, subTodoId: subTodo.id, date }));

  const handleSubTodoDragEnd = ({ data, from, to }: DragEndParams<SubTodo>) => {
    if (from === to || reorderSubTodos.isPending) {
      return;
    }

    reorderSubTodos.mutate({
      todoId: todo.id,
      subTodoIds: data.map((subTodo) => subTodo.id),
      startDate: todo.startDate,
    });
  };

  return (
    <TodoRow
      left={
        <TodoCheckbox
          testID={`todo-checkbox-${todo.id}`}
          accessibilityLabel={todo.title}
          isSelected={todo.completed}
          onSelectedChange={() =>
            toggleTodo.mutate({
              todoId: todo.id,
              body: { completed: !todo.completed },
              startDate: todo.startDate,
            })
          }
          isDisabled={toggleTodo.isPending || isOptimistic}
        />
      }
      top={
        <HStack gap={4} align="center">
          <TodoLabel isChecked={todo.completed}>{todo.title}</TodoLabel>
          {todo.visibility === 'PRIVATE' && (
            <LockIcon width={14} height={14} colorClassName="text-gray-5" />
          )}
        </HStack>
      }
      middle={
        formattedTime != null ? (
          <Text size="e1" shade={6}>
            {formattedTime}
          </Text>
        ) : undefined
      }
      bottom={
        TodoPolicy.hasSubTodos(todo) ? (
          <TodoProgress value={todo.subTodoStats.completed} total={todo.subTodoStats.total} />
        ) : undefined
      }
      right={
        <HStack gap={8} align="center">
          <IconCountButton
            className="min-h-0"
            icon={
              <ChatBubbleIcon
                width={ICON_COUNT_BUTTON_ICON_SIZE}
                height={ICON_COUNT_BUTTON_ICON_SIZE}
                colorClassName="text-gray-6"
              />
            }
            count={todo.commentCount}
            onPress={handleCommentsPress}
            accessibilityRole="button"
            accessibilityLabel={t('detail.open')}
          />
          <PressableFeedback onPress={isOptimistic ? undefined : handleActionsPress} hitSlop={8}>
            <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
          </PressableFeedback>
        </HStack>
      }
      onPress={isOptimistic ? undefined : handleRowPress}
      onLongPress={isOptimistic || isDragDisabled ? undefined : drag}
      isActive={isActive}
      isDisabled={isOptimistic}
    >
      {isExpanded && (
        <SubTodoList
          onAddPress={handleAddSubTodoPress}
          isAddDisabled={!SubTodoPolicy.canAddSubTodo(todo)}
        >
          <NestableDraggableFlatList
            data={todo.subTodos}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, drag: itemDrag, isActive: itemIsActive }) => (
              <ScaleDecorator activeScale={1.015}>
                <SubTodoList.Item
                  label={item.title}
                  isSelected={item.completed}
                  onSelectedChange={(isCompleted) =>
                    toggleSubTodo.mutate({
                      todoId: todo.id,
                      subTodoId: item.id,
                      isCompleted,
                      startDate: todo.startDate,
                    })
                  }
                  onMorePress={() => handleSubTodoMorePress(item)}
                  drag={itemDrag}
                  isActive={itemIsActive}
                  isDragDisabled={reorderSubTodos.isPending}
                />
              </ScaleDecorator>
            )}
            onDragEnd={handleSubTodoDragEnd}
          />
        </SubTodoList>
      )}
    </TodoRow>
  );
};
