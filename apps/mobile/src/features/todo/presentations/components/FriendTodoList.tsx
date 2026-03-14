import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import type { FriendUserViewModel } from '@src/features/friend/presentations/view-models/friend-user.view-model';
import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { useTrack } from '@src/shared/analytics';
import {
  Box,
  DocsIcon,
  Flex,
  HStack,
  PawIcon,
  Result,
  Text,
  useOverlay,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { formatDate, isSameDay } from '@src/shared/utils/date';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { groupBy } from 'es-toolkit';
import times from 'es-toolkit/compat/times';
import { Checkbox, Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { Pressable } from 'react-native';
import { useGetFriendTodosQueryOptions } from '../queries/use-get-friend-todos-query-options';
import { useGetRemindNudgeCooldownQueryOptions } from '../queries/use-get-remind-nudge-cooldown-query-options';
import { useGetTodoNudgeLimitQueryOptions } from '../queries/use-get-todo-nudge-limit-query-options';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { NudgeBottomSheet } from './NudgeBottomSheet';
import { RemindNudgeBottomSheet } from './RemindNudgeBottomSheet';

interface FriendTodoListProps {
  friend: FriendUserViewModel;
  date: Date;
}

export function FriendTodoList({ friend, date }: FriendTodoListProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const { data, isLoading } = useQuery(
    useGetFriendTodosQueryOptions(friend.id, formatDate(date), preference.timeFormat),
  );
  const { data: limitInfo } = useSuspenseQuery(useGetTodoNudgeLimitQueryOptions());
  const isLimitReached = TodoNudgePolicy.isLimitReached(limitInfo);

  const categoryGroups = useMemo(() => {
    if (!data) return [];
    const grouped = groupBy(data.todos, (todo) => todo.category.id);

    return Object.values(grouped).flatMap((todos) => {
      const first = todos[0];
      return first ? [{ category: first.category, todos }] : [];
    });
  }, [data]);

  if (isLoading || !data) {
    return <FriendTodoList.Loading />;
  }

  if (categoryGroups.length === 0) {
    const isToday = isSameDay(date, new Date());
    return (
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title="친구의 등록된 할 일이 없어요"
        description={isToday ? '친구에게 할 일을 만들라고 찔러보세요' : undefined}
        button={isToday ? <RemindNudgeButton friend={friend} /> : undefined}
      />
    );
  }

  return (
    <Box gap={16} px={16}>
      {categoryGroups.map((group) => (
        <VStack key={group.category.id} gap={8}>
          <CategoryHeader category={group.category} />
          <Box>
            {group.todos.map((todo) => (
              <FriendTodoItem
                key={todo.id}
                todo={todo}
                friend={friend}
                isLimitReached={isLimitReached}
                date={date}
              />
            ))}
          </Box>
        </VStack>
      ))}
    </Box>
  );
}

interface CategoryHeaderProps {
  category: TodoItemViewModel['category'];
}

function CategoryHeader({ category }: CategoryHeaderProps) {
  return (
    <Flex className="self-start flex-row items-center rounded-lg bg-gray-2 px-2.5 py-1">
      <Text size="b4" weight="semibold" style={{ color: category.color }}>
        {category.name}
      </Text>
    </Flex>
  );
}

interface FriendTodoItemProps {
  todo: TodoItemViewModel;
  friend: FriendUserViewModel;
  isLimitReached: boolean;
  date: Date;
}

function FriendTodoItem({ todo, friend, isLimitReached, date }: FriendTodoItemProps) {
  const { trackEvent } = useTrack();
  const overlay = useOverlay();
  const premiumDialog = usePremiumDialog();
  const showDateTime = todo.formattedTime && !todo.isAllDay;
  const canNudgeTodo = TodoNudgePolicy.canNudgeTodoOnDate(
    { targetDate: date, isCompleted: todo.completed },
    new Date(),
  );

  const openNudgeDialog = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <NudgeBottomSheet
        friend={friend}
        todo={todo}
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

  const openLimitDialog = () => {
    trackEvent('premium_gate_shown', { feature: 'friend_todo_view' });
    premiumDialog.open({
      title: '오늘 콕 찌르기를 다 했어요',
      description: '구독하면 무제한으로 찌를 수 있어요',
    });
  };

  const handleNudgePress = () => {
    if (isLimitReached) {
      openLimitDialog();
      return;
    }

    openNudgeDialog();
  };

  return (
    <Box py={8}>
      <HStack gap={12} align="center">
        <Checkbox
          className="shadow-none border border-main size-5 rounded-md"
          isSelected={todo.completed}
          isDisabled
        />

        <VStack flex={1} gap={2}>
          <HStack gap={4} align="center">
            <Text
              size="b3"
              weight="medium"
              strikethrough={todo.completed}
              shade={todo.completed ? 5 : undefined}
            >
              {todo.title}
            </Text>
          </HStack>
          {showDateTime && (
            <Text size="e1" shade={6}>
              {todo.formattedTime}
            </Text>
          )}
        </VStack>
        {canNudgeTodo && (
          <Pressable onPress={handleNudgePress} hitSlop={8}>
            <PawIcon width={18} height={18} colorClassName="text-gray-6" />
          </Pressable>
        )}
      </HStack>
    </Box>
  );
}

interface RemindNudgeButtonProps {
  friend: FriendUserViewModel;
}

function RemindNudgeButton({ friend }: RemindNudgeButtonProps) {
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
          {canNudge ? '콕 찌르기' : '이미 콕 찔렀어요'}
        </Text>
        <PawIcon width={16} height={16} colorClassName={canNudge ? 'text-main' : 'text-gray-5'} />
      </HStack>
    </Result.Button>
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
