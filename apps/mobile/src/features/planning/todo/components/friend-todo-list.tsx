import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { isSameDay } from '@src/features/planning/todo/utils/calendar-date';
import { formatTodoTime } from '@src/features/planning/todo/utils/format-todo-time';
import { useFriendScreenParams } from '@src/features/social/friend/hooks/use-friend-screen-params';
import { useScreenFriend } from '@src/features/social/friend/hooks/use-screen-friend';
import type { FriendUserViewModel } from '@src/features/social/friend/utils/view-models/friend-user.view-model';
import { RemindNudgeBottomSheet } from '@src/features/social/nudge/components/nudge-bottom-sheet';
import { TodoNudgeButton } from '@src/features/social/nudge/components/todo-nudge-button';
import { TodoNudgePolicy } from '@src/features/social/nudge/domains/todo-nudge.model';
import { useGetRemindNudgeCooldownQueryOptions } from '@src/features/social/nudge/queries/get-remind-nudge-cooldown-query-options';
import { toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import type { QueryErrorFallbackProps } from '@src/shared/ui';
import {
  Box,
  ChatBubbleIcon,
  DocsIcon,
  Flex,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconCountButton,
  PawIcon,
  QueryErrorActions,
  Result,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { useMemo, useState } from 'react';

import { useFeedDate } from '../hooks/use-feed-date';
import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';
import { useGetFriendTodosQueryOptions } from '../queries/get-friend-todos-query-options';
import { groupFriendTodosByCategory } from '../utils/group-friend-todos-by-category';
import { SubTodoIndent } from './sub-todo-indent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './todo-row';

const COMPACT_ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

export function FriendTodoList() {
  const { friendId } = useFriendScreenParams();
  const [date] = useFeedDate();
  const [{ data: todos }] = useSuspenseQueries({
    queries: [
      useGetFriendTodosQueryOptions({
        friendUserId: friendId,
        date: toDateKey(date, getDeviceTimezone()),
      }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const categoryGroups = useMemo(() => groupFriendTodosByCategory(todos), [todos]);

  if (categoryGroups.length === 0) {
    return <FriendTodoList.Empty />;
  }

  return (
    <Box gap={16}>
      {categoryGroups.map((group) => (
        <VStack key={group.category.id} gap={8}>
          <CategoryHeaderPill label={group.category.name} color={group.category.color} />
          <Box>
            {group.todos.map((todo) => (
              <FriendTodoList.Item key={todo.id} todo={todo} />
            ))}
          </Box>
        </VStack>
      ))}
    </Box>
  );
}

function RemindNudgeButton({ friend }: { friend: FriendUserViewModel }) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const { data: cooldownInfo } = useQuery(
    useGetRemindNudgeCooldownQueryOptions({ userId: friend.id }),
  );
  const canNudge = cooldownInfo?.canNudge ?? true;

  const openRemindNudgeSheet = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <RemindNudgeBottomSheet
        receiver={friend}
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            unmount();
          }
        }}
      />
    ));
  };

  return (
    <Result.Button
      color="primary"
      variant="weak"
      onPress={openRemindNudgeSheet}
      isDisabled={!canNudge}
    >
      <HStack gap={6} align="center">
        <Text size="b4" weight="semibold" shade={canNudge ? undefined : 5}>
          {canNudge ? t('friendTodo.nudge') : t('friendTodo.alreadyNudged')}
        </Text>
        <PawIcon width={16} height={16} colorClassName={canNudge ? 'text-main' : 'text-gray-5'} />
      </HStack>
    </Result.Button>
  );
}

FriendTodoList.Item = function Item({ todo }: { todo: Todo }) {
  const { t } = useTranslation('todo');
  const { data: friend } = useScreenFriend();
  const [date] = useFeedDate();
  const today = useToday();
  const [_selectedTodoId, setSelectedTodoId] = useFeedSelectedTodo();
  const selectTodo = useSingleTap(setSelectedTodoId);
  const [isExpanded, setIsExpanded] = useState(TodoPolicy.hasSubTodos(todo));
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const formattedTime = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const showDateTime = formattedTime != null;
  const canNudgeTodo = TodoNudgePolicy.canNudgeTodoOnDate(
    { targetDate: date, isCompleted: todo.completed },
    today,
  );

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
          {canNudgeTodo && friend != null && (
            <TodoNudgeButton
              receiver={friend}
              todo={todo}
              className="min-h-0 py-1.5"
              hitSlop={COMPACT_ACTION_HIT_SLOP}
            />
          )}
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

FriendTodoList.Empty = function Empty() {
  const { t } = useTranslation('todo');
  const { data: friend } = useScreenFriend();
  const [date] = useFeedDate();
  const today = useToday();
  const isToday = isSameDay(date, today);
  return (
    <Flex flex={1} justify="center" align="center">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('friendTodo.emptyTitle')}
        description={isToday ? t('friendTodo.emptyDescription') : undefined}
        button={isToday && friend != null ? <RemindNudgeButton friend={friend} /> : undefined}
      />
    </Flex>
  );
};
