import type { FriendUserViewModel } from '@src/features/friend/presentations/view-models/friend-user.view-model';
import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { Box } from '@src/shared/ui/Box/Box';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { DocsIcon, PawIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { usePremiumDialog } from '@src/shared/ui/PremiumDialog';
import { Result } from '@src/shared/ui/Result/Result';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate } from '@src/shared/utils/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { groupBy } from 'es-toolkit';
import times from 'es-toolkit/compat/times';
import { Checkbox, Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { Pressable } from 'react-native';
import { getFriendTodosQueryOptions } from '../queries/get-friend-todos-query-options';
import { getTodoNudgeLimitQueryOptions } from '../queries/get-todo-nudge-limit-query-options';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { NudgeBottomSheet } from './NudgeBottomSheet';

interface FriendTodoListProps {
  friend: FriendUserViewModel;
  date: Date;
}

export function FriendTodoList({ friend, date }: FriendTodoListProps) {
  const { data } = useSuspenseQuery(getFriendTodosQueryOptions(friend.id, formatDate(date)));
  const { data: limitInfo } = useSuspenseQuery(getTodoNudgeLimitQueryOptions());
  const isLimitReached = TodoNudgePolicy.isLimitReached(limitInfo);

  const categoryGroups = useMemo(() => {
    const grouped = groupBy(data.todos, (todo) => todo.category.id);

    return Object.values(grouped).flatMap((todos) => {
      const first = todos[0];
      return first ? [{ category: first.category, todos }] : [];
    });
  }, [data.todos]);

  if (categoryGroups.length === 0) {
    return (
      <Flex flex={1} justify="center" align="center">
        <Result icon={<DocsIcon width={72} height={72} />} title="등록된 할 일이 없어요" />
      </Flex>
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
