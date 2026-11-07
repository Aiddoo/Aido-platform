import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
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

import { TodoPolicy } from '../domains/todo.model';
import { useFeedDateKey, useFeedDate } from '../hooks/use-feed-params';
import { useFeedSelectedTodoId } from '../hooks/use-feed-selected-todo-id';
import { useGetFriendTodosQueryOptions } from '../queries/todo.queries';
import type { Todo } from '../schemas/todo.schema';
import { formatTodoTime } from '../utils/format-todo-time';
import { groupFriendTodosByCategory } from '../utils/group-friend-todos-by-category';
import { SubTodoIndent } from './sub-todo-indent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './todo-row';

interface FriendTodoListProps {
  friendId: string;
  /** 할 일 줄 오른쪽에 붙는 행동(콕 등). 다시 마운트되지 않도록 모듈 수준 컴포넌트를 넘긴다 */
  rowAction: ComponentType<{ todo: Todo }>;
  /** 친구에게 할 일이 없는 오늘 빈 화면에 붙는 행동(독촉 콕 등) */
  emptyAction: ComponentType;
}

export function FriendTodoList({ friendId, rowAction, emptyAction }: FriendTodoListProps) {
  const { timeZone } = useDateFormatContext();
  const [date] = useFeedDate();
  const [{ data: todos }] = useSuspenseQueries({
    queries: [
      useGetFriendTodosQueryOptions({
        friendUserId: friendId,
        date: toDateKey(date, timeZone),
      }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const categoryGroups = useMemo(() => groupFriendTodosByCategory(todos.todos), [todos]);

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
  const [_selectedTodoId, openTodoDetail] = useFeedSelectedTodoId();
  const selectTodo = useSingleTap(openTodoDetail);
  const [isExpanded, setIsExpanded] = useState(TodoPolicy.hasSubTodos(todo));
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const formattedTime = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const showDateTime = formattedTime != null;

  const openComments = () => selectTodo(todo.id);

  return (
    <TodoRow
      left={<TodoCheckbox isSelected={todo.completed} />}
      top={<TodoLabel isCompleted={todo.completed}>{todo.title}</TodoLabel>}
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
              top={<TodoLabel isCompleted={subTodo.completed}>{subTodo.title}</TodoLabel>}
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
  const [selectedDateKey] = useFeedDateKey();
  const isToday = selectedDateKey === useTodayKey();

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
