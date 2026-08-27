import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import type { FriendUserViewModel } from '@src/features/friend/presentations/view-models/friend-user.view-model';
import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useToday } from '@src/shared/hooks/useToday';
import { useTranslation } from '@src/shared/i18n';
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
import { formatDate, isSameDay } from '@src/shared/utils/date';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useState } from 'react';

import { useFeedDate } from '../hooks/use-feed-date';
import { useGetFriendTodosQueryOptions } from '../queries/use-get-friend-todos-query-options';
import { useGetRemindNudgeCooldownQueryOptions } from '../queries/use-get-remind-nudge-cooldown-query-options';
import { useGetTodoNudgeLimitQueryOptions } from '../queries/use-get-todo-nudge-limit-query-options';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { RemindNudgeBottomSheet } from './RemindNudgeBottomSheet';
import { TodoNudgeButton } from './TodoNudgeButton';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './TodoRow';

interface FriendTodoListProps {
  friend: FriendUserViewModel;
}

export function FriendTodoList({ friend }: FriendTodoListProps) {
  const { t } = useTranslation('todo');
  const [date] = useFeedDate();
  const today = useToday();
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const { data: categoryGroups } = useSuspenseQuery(
    useGetFriendTodosQueryOptions(friend.id, formatDate(date), preference.timeFormat),
  );
  const { data: limitInfo } = useSuspenseQuery(useGetTodoNudgeLimitQueryOptions());
  const isLimitReached = TodoNudgePolicy.isLimitReached(limitInfo);

  if (categoryGroups.length === 0) {
    const isToday = isSameDay(date, today);

    return (
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('friendTodo.emptyTitle')}
        description={isToday ? t('friendTodo.emptyDescription') : undefined}
        button={isToday ? <RemindNudgeButton friend={friend} /> : undefined}
      />
    );
  }

  return (
    <Box gap={16} px={16}>
      {categoryGroups.map((group) => (
        <VStack key={group.category.id} gap={8}>
          <CategoryHeader label={group.category.name} color={group.category.color} />
          <Box>
            {group.todos.map((todo) => (
              <FriendTodoItem
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
    <VStack px={16} gap={12}>
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
  todo: TodoItemViewModel;
  friend: FriendUserViewModel;
  isLimitReached: boolean;
  date: Date;
  today: Date;
}

function FriendTodoItem({ todo, friend, isLimitReached, date, today }: FriendTodoItemProps) {
  const { t } = useTranslation('todo');
  const push = useSingleTap(router.push);
  const [isExpanded, setIsExpanded] = useState(todo.hasSubTodos);
  const showDateTime = todo.formattedTime && !todo.isAllDay;
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
            {todo.formattedTime}
          </Text>
        )
      }
      bottom={
        todo.hasSubTodos && (
          <TodoProgress value={todo.subTodoStats.completed} total={todo.subTodoStats.total} />
        )
      }
      right={
        <HStack gap={4} align="center">
          <IconCountButton
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
            <TodoNudgeButton receiver={friend} todo={todo} isLimitReached={isLimitReached} />
          )}
        </HStack>
      }
      onPress={todo.hasSubTodos ? () => setIsExpanded((prev) => !prev) : undefined}
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
}

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
