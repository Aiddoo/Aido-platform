import type { FriendUserViewModel } from '@src/features/friend/utils/view-models/friend-user.view-model';
import { RemindNudgeBottomSheet } from '@src/features/nudge/components/remind-nudge-bottom-sheet';
import { TodoNudgeButton } from '@src/features/nudge/components/todo-nudge-button';
import { TodoNudgePolicy } from '@src/features/nudge/domains/todo-nudge.model';
import { useGetRemindNudgeCooldownQueryOptions } from '@src/features/nudge/queries/get-remind-nudge-cooldown-query-options';
import { useGetTodoNudgeLimitQueryOptions } from '@src/features/nudge/queries/get-todo-nudge-limit-query-options';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { TodoPolicy } from '@src/features/todo/domains/todo.model';
import type { Todo } from '@src/features/todo/domains/todo.model';
import { formatTodoTime } from '@src/features/todo/utils/format-todo-time';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday } from '@src/shared/hooks/use-today';
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
  PawIcon,
  Result,
  Text,
  VStack,
  useOverlay,
} from '@src/shared/ui';
import { getDateFormatContext } from '@src/shared/utils/date';
import { formatDate, isSameDay } from '@src/shared/utils/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useMemo, useState } from 'react';

import { useFeedDate } from '../hooks/use-feed-date';
import { useGetFriendTodosQueryOptions } from '../queries/get-friend-todos-query-options';
import { toFriendCategoryGroups } from '../utils/view-models/friend-todos.view-model';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './todo-row';

const COMPACT_ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

interface FriendTodoListProps {
  friend: FriendUserViewModel;
}

export function FriendTodoList({ friend }: FriendTodoListProps) {
  const [date] = useFeedDate();
  const today = useToday();
  const [{ data: todos }, { data: limitInfo }] = useSuspenseQueries({
    queries: [
      useGetFriendTodosQueryOptions(friend.id, formatDate(date)),
      useGetTodoNudgeLimitQueryOptions(),
    ],
  });
  const categoryGroups = useMemo(() => toFriendCategoryGroups(todos), [todos]);
  const isLimitReached = TodoNudgePolicy.isLimitReached(limitInfo);

  if (categoryGroups.length === 0) {
    return <FriendTodoList.Empty friend={friend} />;
  }

  return (
    <Box gap={16}>
      {categoryGroups.map((group) => (
        <VStack key={group.category.id} gap={8}>
          <CategoryHeader label={group.category.name} color={group.category.color} />
          <Box>
            {group.todos.map((todo) => (
              <FriendTodoList.Item
                key={todo.id}
                todo={todo}
                friend={friend}
                isLimitReached={isLimitReached}
                date={date}
                today={today}
              />
            ))}
          </Box>
        </VStack>
      ))}
    </Box>
  );
}

FriendTodoList.Loading = function Loading() {
  return (
    <VStack gap={12}>
      {times(3, (i) => (
        <HStack key={`friend-todo-skeleton-${i}`} gap={12} align="center" className="py-3">
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

function CategoryHeader({ label, color }: { label: string; color: string }) {
  return (
    <Flex className="self-start flex-row items-center rounded-lg bg-gray-2 px-2.5 py-1">
      <Text size="b4" weight="semibold" style={{ color }}>
        {label}
      </Text>
    </Flex>
  );
}

interface FriendTodoItemProps {
  todo: Todo;
  friend: FriendUserViewModel;
  isLimitReached: boolean;
  date: Date;
  today: Date;
}

FriendTodoList.Item = function Item({
  todo,
  friend,
  isLimitReached,
  date,
  today,
}: FriendTodoItemProps) {
  const { t } = useTranslation('todo');
  const push = useSingleTap(router.push);
  const [isExpanded, setIsExpanded] = useState(TodoPolicy.hasSubTodos(todo));
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const formattedTime = formatTodoTime(todo, preference.timeFormat, getDateFormatContext());
  const showDateTime = formattedTime != null;
  const canNudgeTodo = TodoNudgePolicy.canNudgeTodoOnDate(
    { targetDate: date, isCompleted: todo.completed },
    today,
  );

  const openComments = () => push({ pathname: '/todo/[todoId]', params: { todoId: todo.id } });

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
          {canNudgeTodo && (
            <TodoNudgeButton
              receiver={friend}
              todo={todo}
              isLimitReached={isLimitReached}
              className="min-h-0 py-1.5"
              hitSlop={COMPACT_ACTION_HIT_SLOP}
            />
          )}
        </HStack>
      }
      onPress={TodoPolicy.hasSubTodos(todo) ? () => setIsExpanded((prev) => !prev) : undefined}
    >
      {isExpanded && (
        <VStack className="ml-8 pl-4 border-l border-gray-2">
          {todo.subTodos.map((subTodo) => (
            <TodoRow
              key={subTodo.id}
              left={<TodoCheckbox isSelected={subTodo.completed} />}
              top={<TodoLabel isChecked={subTodo.completed}>{subTodo.title}</TodoLabel>}
            />
          ))}
        </VStack>
      )}
    </TodoRow>
  );
};

interface RemindNudgeButtonProps {
  friend: FriendUserViewModel;
}

function RemindNudgeButton({ friend }: RemindNudgeButtonProps) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const { data: cooldownInfo } = useQuery(useGetRemindNudgeCooldownQueryOptions(friend.id));
  const canNudge = cooldownInfo?.canNudge ?? true;

  const openRemindNudgeSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <RemindNudgeBottomSheet
        friend={friend}
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
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

FriendTodoList.Empty = function Empty({ friend }: FriendTodoListProps) {
  const { t } = useTranslation('todo');
  const [date] = useFeedDate();
  const today = useToday();
  const isToday = isSameDay(date, today);
  return (
    <Result
      icon={<DocsIcon width={72} height={72} />}
      title={t('friendTodo.emptyTitle')}
      description={isToday ? t('friendTodo.emptyDescription') : undefined}
      button={isToday ? <RemindNudgeButton friend={friend} /> : undefined}
    />
  );
};

FriendTodoList.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  return (
    <Result
      title={t('todo:list.loadError')}
      button={<Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>}
    />
  );
};
