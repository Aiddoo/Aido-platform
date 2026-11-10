import { ReorderCoachmark } from '@src/features/device/coachmark/components/reorder-coachmark';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import type { TodoCategoryWithCount } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useReorderableList } from '@src/shared/hooks/use-reorderable-list';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ChatBubbleIcon,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconButton,
  IconCountButton,
  MoreIcon,
  PlusIcon,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { groupBy, noop, range } from 'es-toolkit';
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

import { SubTodoPolicy } from '../../domains/sub-todo.model';
import { type SubTodo } from '../../domains/sub-todo.model';
import { isPrivateVisibility, TodoPolicy } from '../../domains/todo.model';
import { type Todo } from '../../domains/todo.model';
import { useFeedDate } from '../../hooks/use-feed-params';
import { useFeedSelectedTodoId } from '../../hooks/use-feed-selected-todo-id';
import {
  useReorderSubTodosMutationOptions,
  useToggleSubTodoMutationOptions,
} from '../../queries/sub-todo.mutations';
import {
  useReorderTodoMutationOptions,
  useToggleTodoMutationOptions,
} from '../../queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '../../queries/todo.queries';
import { formatTodoTime } from '../../utils/format-todo-time';
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

interface TodoListProps {
  /** 알림 권한은 위층 기능이라 화면이 한 번 읽어 넘긴다. 켜져 있으면 시간 옆 종 꺼짐을 그리지 않는다 */
  isReminderOff?: boolean;
}

export function TodoList({ isReminderOff = false }: TodoListProps) {
  const { timeZone } = useDateFormatContext();
  const [selectedDate] = useFeedDate();
  const date = toDateKey(selectedDate, timeZone);
  // 행마다 route 훅을 부르면 URL이 바뀔 때마다 행 수만큼 params를 다시 파싱한다. 목록이 한 번 읽어 넘긴다
  const [_selectedTodoId, openTodoDetail] = useFeedSelectedTodoId();
  const [{ data: categoriesResult }, { data: todosByDate, dataUpdatedAt }] = useSuspenseQueries({
    queries: [
      useGetTodoCategoriesQueryOptions(),
      useGetTodosByDateQueryOptions({ date }),
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
            date={date}
          />

          <TodoReorderableList
            items={group.todos}
            updatedAt={dataUpdatedAt}
            date={date}
            isReminderOff={isReminderOff}
            onOpenDetail={openTodoDetail}
          />
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
    <HStack flex={1} justify="center" align="center">
      <QueryErrorFallback title={t('list.loadError')} reset={reset} />
    </HStack>
  );
};

interface CategoryHeaderProps {
  label: string;
  color: string;
  categoryId: number;
  date: string;
}

function CategoryHeader({ label, color, categoryId, date }: CategoryHeaderProps) {
  const fontScaledSize = useFontScaledSize();
  const push = useSingleTap(router.push);

  return (
    <PressableFeedback
      onPress={() => push({ pathname: '/todo/new', params: { date, categoryId } })}
      hitSlop={8}
      className="self-start"
    >
      <CategoryHeaderPill label={label} color={color} pointerEvents="none">
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
  /** 보고 있는 날짜. 여러 날 할 일은 시작일이 아니라 이 날짜 목록을 고친다 */
  date: string;
  isReminderOff: boolean;
  onOpenDetail: (todoId: number) => void;
}

function TodoReorderableList({
  items,
  updatedAt,
  date,
  isReminderOff,
  onOpenDetail,
}: TodoReorderableListProps) {
  const reorderMutation = useMutation(useReorderTodoMutationOptions());
  const reorderableList = useReorderableList({
    items,
    updatedAt,
    isPending: reorderMutation.isPending,
    getItemId: (todo) => todo.id,
    isOptimistic: TodoPolicy.isOptimisticTodo,
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
      renderItem={({ item }) => (
        <TodoList.Item
          todo={item}
          updatedAt={updatedAt}
          date={date}
          isReminderOff={isReminderOff}
          onOpenDetail={onOpenDetail}
        />
      )}
    />
  );
}

interface TodoListItemProps {
  todo: Todo;
  updatedAt: number;
  date: string;
  isReminderOff: boolean;
  onOpenDetail: (todoId: number) => void;
}

TodoList.Item = function Item({
  todo,
  updatedAt,
  date,
  isReminderOff,
  onOpenDetail,
}: TodoListItemProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const selectTodo = useSingleTap(onOpenDetail);

  const { t } = useTranslation('todo');
  const push = useSingleTap(router.push);
  const toggleTodo = useMutation(useToggleTodoMutationOptions());
  const toggleSubTodo = useMutation(useToggleSubTodoMutationOptions());
  const reorderSubTodos = useMutation(useReorderSubTodosMutationOptions());
  // 접거나 펴기 전에는 서브투두 유무를 따른다. 처음 값으로만 두면 나중에 생긴 서브투두가 접힌 채 남는다
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const isExpanded = userExpanded ?? SubTodoPolicy.hasSubTodos(todo.subTodos);
  const subTodoStats = SubTodoPolicy.getSubTodoStats(todo.subTodos);
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const formattedTime = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const isOptimistic = TodoPolicy.isOptimisticTodo(todo);

  const handleRowPress = () => setUserExpanded(!isExpanded);

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
    isOptimistic: SubTodoPolicy.isOptimisticSubTodo,
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
            <TodoLabel isCompleted={todo.completed} className="flex-1">
              {todo.title}
            </TodoLabel>
          }
          isPrivate={isPrivateVisibility(todo.visibility)}
        />
      }
      middle={
        formattedTime != null || TodoPolicy.isRecurringTodo(todo) ? (
          <TodoScheduleLine
            todo={todo}
            timeLabel={formattedTime}
            isReminderOff={isReminderOff && !todo.completed}
          />
        ) : undefined
      }
      bottom={
        SubTodoPolicy.hasSubTodos(todo.subTodos) ? (
          <TodoProgress value={subTodoStats.completed} total={subTodoStats.total} />
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
      onPress={handleRowPress}
      onLongPress={drag}
      isActive={isActive}
      isDisabled={isOptimistic}
    >
      {isExpanded && (
        <SubTodoList
          onAddPress={handleAddSubTodoPress}
          canAdd={SubTodoPolicy.canAddSubTodo(todo.subTodos)}
        >
          <NestedReorderableList
            {...subTodoReorderableList}
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

function groupTodosByCategory(todos: readonly Todo[], categories: TodoCategoryWithCount[]) {
  const grouped = groupBy(todos, (todo) => todo.category.id);
  return categories.map((category) => ({ category, todos: grouped[category.id] ?? [] }));
}
