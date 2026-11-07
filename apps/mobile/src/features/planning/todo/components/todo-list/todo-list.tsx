import { ReorderCoachmark } from '@src/features/device/coachmark/components/reorder-coachmark';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { type SubTodo } from '@src/features/planning/todo/schemas/sub-todo.schema';
import { type Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { formatTodoTime } from '@src/features/planning/todo/utils/format-todo-time';
import { toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useReorderableList } from '@src/shared/hooks/use-reorderable-list';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ChatBubbleIcon,
  Flex,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconCountButton,
  MoreIcon,
  PlusIcon,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  IconButton,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { noop, range } from 'es-toolkit';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useMemo, useState } from 'react';
import type { AccessibilityActionEvent } from 'react-native';
import {
  NestedReorderableList,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { match } from 'ts-pattern';

import { useFeedDateParam, useFeedDateKey } from '../../hooks/use-feed-params';
import { useFeedSelectedTodo } from '../../hooks/use-feed-selected-todo';
import {
  useReorderSubTodosMutationOptions,
  useToggleSubTodoMutationOptions,
} from '../../queries/sub-todo.mutations';
import {
  useReorderTodoMutationOptions,
  useToggleTodoMutationOptions,
} from '../../queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '../../queries/todo.queries';
import { groupTodosByCategory } from '../../utils/group-todos-by-category';
import { SubTodoList } from '../sub-todo-list/sub-todo-list';
import {
  TODO_ROW_ACCESSIBILITY_ACTION,
  TodoCheckbox,
  TodoLabel,
  TodoProgress,
  TodoRow,
  TodoScheduleLine,
  TodoTitleLine,
} from '../todo-row';

export function TodoList() {
  const { timeZone } = useDateFormatContext();
  const [selectedDate] = useFeedDateParam();
  const [{ data: categoriesResult }, { data: todosByDate, dataUpdatedAt }] = useSuspenseQueries({
    queries: [
      useGetTodoCategoriesQueryOptions(),
      useGetTodosByDateQueryOptions({ date: toDateKey(selectedDate, timeZone) }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const categoryGroups = useMemo(
    () => groupTodosByCategory(todosByDate.todos, categoriesResult.categories),
    [todosByDate.todos, categoriesResult.categories],
  );
  const canReorderTodos = categoryGroups.some((group) => TodoPolicy.canReorderTodos(group.todos));

  return (
    <Box gap={16}>
      {categoryGroups.map((group) => (
        <Box key={group.category.id} gap={8}>
          <CategoryHeader
            label={group.category.name}
            color={group.category.color}
            categoryId={group.category.id}
          />

          <TodoReorderableList items={group.todos} updatedAt={dataUpdatedAt} />
        </Box>
      ))}
      {/* 목록 위에 나타나면 행이 통째로 밀려 누르려던 곳이 움직인다. 나타나고 닫혀도 행은 그 자리다 */}
      {canReorderTodos && <ReorderCoachmark kind="todo" />}
    </Box>
  );
}

TodoList.Loading = function Loading() {
  return (
    <Box gap={8}>
      <CategoryHeaderPill.Loading />
      <Box>
        {range(5).map((index) => (
          <TodoRow.Loading key={index} />
        ))}
      </Box>
    </Box>
  );
};

TodoList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <Flex flex={1} justify="center" align="center">
      <Result title={t('list.loadError')} button={<QueryErrorActions onRetry={reset} />} />
    </Flex>
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
      onPress={() => push({ pathname: '/todo/new', params: { date, categoryId } })}
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

interface TodoReorderableListProps {
  items: Todo[];
  updatedAt: number;
}

function TodoReorderableList({ items, updatedAt }: TodoReorderableListProps) {
  const reorderMutation = useMutation(useReorderTodoMutationOptions());
  const reorderableList = useReorderableList({
    items,
    updatedAt,
    isPending: reorderMutation.isPending,
    getItemId: (todo) => todo.id,
    onReorder: ({ instruction: { movedId, targetId, position } }) => {
      reorderMutation.mutate({
        id: movedId,
        input: { targetTodoId: targetId, position },
      });
    },
  });

  return (
    <NestedReorderableList
      {...reorderableList}
      shouldUpdateActiveItem
      scrollEnabled={false}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <TodoList.Item todo={item} updatedAt={updatedAt} />}
    />
  );
}

interface TodoListItemProps {
  todo: Todo;
  updatedAt: number;
}

TodoList.Item = function Item({ todo, updatedAt }: TodoListItemProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
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
  const dateFormatContext = useDateFormatContext();
  const formattedTime = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const isOptimistic = TodoPolicy.isOptimisticTodo(todo);

  const handleRowPress = () => setIsExpanded((current) => !current);

  const handleCommentsPress = () => selectTodo(todo.id);

  const handleActionsPress = () =>
    push({ pathname: '/todo/[todoId]/actions', params: { todoId: todo.id, date } });

  const handleAddSubTodoPress = () =>
    push({ pathname: '/todo/[todoId]/sub-todos/new', params: { todoId: todo.id, date } });

  const handleSubTodoMorePress = (subTodo: SubTodo) =>
    push({
      pathname: '/todo/[todoId]/sub-todos/[subTodoId]/actions',
      params: { todoId: todo.id, subTodoId: subTodo.id, date },
    });

  const subTodoReorderableList = useReorderableList({
    items: todo.subTodos,
    updatedAt,
    isPending: reorderSubTodos.isPending,
    getItemId: (subTodo) => subTodo.id,
    onReorder: ({ items: reorderedSubTodos }) => {
      reorderSubTodos.mutate({
        todoId: todo.id,
        subTodoIds: reorderedSubTodos.map((subTodo) => subTodo.id),
        date,
      });
    },
  });

  const handleCompletedToggle = () =>
    toggleTodo.mutate({
      todoId: todo.id,
      body: { completed: !todo.completed },
      date,
    });

  /** 행이 하나의 접근성 요소로 읽히므로 안쪽 체크박스·댓글·더보기를 VoiceOver/TalkBack 동작으로 제공한다. */
  const handleAccessibilityAction = (event: AccessibilityActionEvent) =>
    match(event.nativeEvent.actionName)
      .with(TODO_ROW_ACCESSIBILITY_ACTION.toggleCompleted, handleCompletedToggle)
      .with(TODO_ROW_ACCESSIBILITY_ACTION.comments, handleCommentsPress)
      .with(TODO_ROW_ACCESSIBILITY_ACTION.more, handleActionsPress)
      .otherwise(noop);

  return (
    <TodoRow
      accessibilityActions={
        isOptimistic
          ? undefined
          : [
              {
                name: TODO_ROW_ACCESSIBILITY_ACTION.toggleCompleted,
                label: t(todo.completed ? 'actions.uncomplete' : 'actions.complete'),
              },
              { name: TODO_ROW_ACCESSIBILITY_ACTION.comments, label: t('detail.open') },
              { name: TODO_ROW_ACCESSIBILITY_ACTION.more, label: t('actions.more') },
            ]
      }
      onAccessibilityAction={handleAccessibilityAction}
      left={
        <TodoCheckbox
          testID={`todo-checkbox-${todo.id}`}
          accessibilityLabel={todo.title}
          isSelected={todo.completed}
          onSelectedChange={handleCompletedToggle}
          isDisabled={toggleTodo.isPending || isOptimistic}
        />
      }
      top={
        <TodoTitleLine
          label={
            <TodoLabel isChecked={todo.completed} className="flex-1">
              {todo.title}
            </TodoLabel>
          }
          isPrivate={TodoPolicy.isPrivate(todo)}
        />
      }
      middle={
        formattedTime != null || TodoPolicy.isRecurringTodo(todo) ? (
          <TodoScheduleLine todo={todo} timeLabel={formattedTime} />
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
            onPress={isOptimistic ? undefined : handleCommentsPress}
            accessibilityRole="button"
            accessibilityLabel={t('detail.open')}
          />
          <IconButton
            accessibilityLabel={t('actions.more')}
            icon={<MoreIcon width={20} height={20} colorClassName="text-gray-5" />}
            className="min-h-0 min-w-0"
            hitSlop={8}
            onPress={isOptimistic ? undefined : handleActionsPress}
          />
        </HStack>
      }
      onPress={isOptimistic ? undefined : handleRowPress}
      onLongPress={isOptimistic ? undefined : drag}
      isActive={isActive}
      isDisabled={isOptimistic}
    >
      {isExpanded && (
        <SubTodoList
          onAddPress={handleAddSubTodoPress}
          isAddDisabled={!SubTodoPolicy.canAddSubTodo(todo)}
        >
          <NestedReorderableList
            {...subTodoReorderableList}
            dragEnabled={
              subTodoReorderableList.dragEnabled &&
              !todo.subTodos.some(SubTodoPolicy.isOptimisticSubTodo)
            }
            shouldUpdateActiveItem
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <SubTodoList.Item
                testID={`sub-todo-checkbox-${item.id}`}
                label={item.title}
                isSelected={item.completed}
                isDisabled={SubTodoPolicy.isOptimisticSubTodo(item)}
                onSelectedChange={(isCompleted) =>
                  toggleSubTodo.mutate({
                    todoId: todo.id,
                    subTodoId: item.id,
                    isCompleted,
                    date,
                  })
                }
                onMorePress={() => handleSubTodoMorePress(item)}
              />
            )}
          />
        </SubTodoList>
      )}
    </TodoRow>
  );
};
