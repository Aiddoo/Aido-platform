import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { formatTodoTime } from '@src/features/planning/todo/utils/format-todo-time';
import { useFriendScreenParams } from '@src/features/social/friend/hooks/use-friend-screen-params';
import { toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import type { QueryErrorFallbackProps } from '@src/shared/ui';
import {
  Box,
  ChatBubbleIcon,
  DocsIcon,
  Flex,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconCountButton,
  QueryErrorActions,
  Result,
  Text,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { type ComponentType, useMemo, useState } from 'react';

import { useFeedDateKey, useFeedDateParam } from '../hooks/use-feed-params';
import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';
import { useGetFriendTodosQueryOptions } from '../queries/todo.queries';
import { groupFriendTodosByCategory } from '../utils/group-friend-todos-by-category';
import { SubTodoIndent } from './sub-todo-indent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './todo-row';

interface FriendTodoListProps {
  /** 할 일 줄 오른쪽에 붙는 행동(콕 등). 다시 마운트되지 않도록 모듈 수준 컴포넌트를 넘긴다 */
  rowAction: ComponentType<{ todo: Todo }>;
  /** 친구에게 할 일이 없는 오늘 빈 화면에 붙는 행동(독촉 콕 등) */
  emptyAction: ComponentType;
}

export function FriendTodoList({ rowAction, emptyAction }: FriendTodoListProps) {
  const { timeZone } = useDateFormatContext();
  const { friendId } = useFriendScreenParams();
  const [date] = useFeedDateParam();
  const [{ data: todos }] = useSuspenseQueries({
    queries: [
      useGetFriendTodosQueryOptions({
        friendUserId: friendId,
        date: toDateKey(date, timeZone),
      }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const categoryGroups = useMemo(() => groupFriendTodosByCategory(todos), [todos]);

  if (categoryGroups.length === 0) {
    return <FriendTodoList.Empty action={emptyAction} />;
  }

  return (
    <Box gap={16}>
      {categoryGroups.map((group) => (
        <VStack key={group.category.id} gap={8}>
          <CategoryHeaderPill label={group.category.name} color={group.category.color} />
          <Box>
            {group.todos.map((todo) => (
              <FriendTodoList.Item key={todo.id} todo={todo} action={rowAction} />
            ))}
          </Box>
        </VStack>
      ))}
    </Box>
  );
}

FriendTodoList.Item = function Item({
  todo,
  action: RowAction,
}: {
  todo: Todo;
  action: ComponentType<{ todo: Todo }>;
}) {
  const { t } = useTranslation('todo');
  const [_selectedTodoId, setSelectedTodoId] = useFeedSelectedTodo();
  const selectTodo = useSingleTap(setSelectedTodoId);
  const [isExpanded, setIsExpanded] = useState(TodoPolicy.hasSubTodos(todo));
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const formattedTime = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const showDateTime = formattedTime != null;

  const openComments = () => selectTodo(todo.id);

  return (
    <TodoRow
      left={<TodoCheckbox isSelected={todo.completed} />}
      top={<TodoLabel isChecked={todo.completed}>{todo.title}</TodoLabel>}
      middle={
        showDateTime && (
          <Text size="e1" shade={6}>
            {formattedTime}
          </Text>
        )
      }
      bottom={
        TodoPolicy.hasSubTodos(todo) && (
          <TodoProgress value={todo.subTodoStats.completed} total={todo.subTodoStats.total} />
        )
      }
      right={
        <HStack gap={4} align="center">
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
            onPress={openComments}
            accessibilityRole="button"
            accessibilityLabel={t('detail.open')}
          />
          <RowAction todo={todo} />
        </HStack>
      }
      onPress={TodoPolicy.hasSubTodos(todo) ? () => setIsExpanded((prev) => !prev) : undefined}
    >
      {isExpanded && (
        <SubTodoIndent>
          {todo.subTodos.map((subTodo) => (
            <TodoRow
              key={subTodo.id}
              left={<TodoCheckbox isSelected={subTodo.completed} />}
              top={<TodoLabel isChecked={subTodo.completed}>{subTodo.title}</TodoLabel>}
            />
          ))}
        </SubTodoIndent>
      )}
    </TodoRow>
  );
};

FriendTodoList.Loading = function Loading() {
  return (
    <VStack gap={8}>
      <CategoryHeaderPill.Loading />
      <Box>
        {range(3).map((index) => (
          <TodoRow.Loading key={index} />
        ))}
      </Box>
    </VStack>
  );
};

FriendTodoList.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  return (
    <Flex flex={1} justify="center" align="center">
      <Result title={t('todo:list.loadError')} button={<QueryErrorActions onRetry={reset} />} />
    </Flex>
  );
};

FriendTodoList.Empty = function Empty({ action: EmptyAction }: { action: ComponentType }) {
  const { t } = useTranslation('todo');
  const isToday = useFeedDateKey() === useTodayKey();
  return (
    <Flex flex={1} justify="center" align="center">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('friendTodo.emptyTitle')}
        description={isToday ? t('friendTodo.emptyDescription') : undefined}
        button={isToday ? <EmptyAction /> : undefined}
      />
    </Flex>
  );
};
