import type { TodoDetailsResponse } from '@aido/validators';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useTodayKey } from '@src/shared/hooks/useToday';
import { useTranslation } from '@src/shared/i18n';
import { Avatar, ChatBubbleIcon, EyeIcon, HStack, Text, VStack } from '@src/shared/ui';
import { formatFullDate } from '@src/shared/utils/date';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import { TodoNudgePolicy } from '../../models/todo-nudge.model';
import { useTodoScreenParams } from '../hooks/use-todo-screen-params';
import { useGetTodoNudgeLimitQueryOptions } from '../queries/use-get-todo-nudge-limit-query-options';
import { useTodoDetailsQueryOptions } from '../queries/use-todo-page-query-options';
import { TodoNudgeButton } from './TodoNudgeButton';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './TodoRow';

export function TodoDetailCard() {
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));

  return (
    <VStack gap={14}>
      <TodoOwnerLine detail={detail} />
      <TodoBody detail={detail} />
      <TodoMetricLine detail={detail} />
    </VStack>
  );
}

type TodoDetailSectionProps = { detail: TodoDetailsResponse };

function TodoOwnerLine({ detail }: TodoDetailSectionProps) {
  const { t } = useTranslation('todo');
  const ownerName = detail.owner.name ?? t('detail.unknownOwner');

  return (
    <HStack gap={10} align="center">
      <Avatar alt={ownerName} className="size-11">
        <Avatar.Image source={getProfileIconSource(detail.owner.profileImage)} />
      </Avatar>
      <VStack flex={1} gap={2} className="min-w-0">
        <Text size="b3" weight="semibold">
          {ownerName}
        </Text>
        <Text size="e1" shade={5}>
          {formatFullDate(detail.todo.startDate)}
        </Text>
      </VStack>
    </HStack>
  );
}

function TodoBody({ detail }: TodoDetailSectionProps) {
  const { todo } = detail;

  return (
    <VStack>
      <TodoRow
        left={<TodoCheckbox isSelected={todo.completed} />}
        top={<TodoLabel isChecked={todo.completed}>{todo.title}</TodoLabel>}
        middle={
          todo.items.length > 0 && (
            <TodoProgress value={todo.itemStats.completed} total={todo.itemStats.total} />
          )
        }
      />

      {todo.items.length > 0 && (
        <VStack className="ml-8 border-l border-gray-2 pl-4" gap={0}>
          {todo.items.map((item) => (
            <TodoRow
              key={item.id}
              left={<TodoCheckbox isSelected={item.completed} />}
              top={<TodoLabel isChecked={item.completed}>{item.title}</TodoLabel>}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function TodoMetricLine({ detail }: TodoDetailSectionProps) {
  const todayKey = useTodayKey();
  const canNudge = TodoNudgePolicy.canNudgeTodoInRange(
    {
      canNudge: detail.permissions.canNudge,
      isCompleted: detail.todo.completed,
      startDate: detail.todo.startDate,
      endDate: detail.todo.endDate,
    },
    todayKey,
  );

  return (
    <HStack gap={16} align="center">
      <MetricItem
        icon={<EyeIcon width={16} height={16} colorClassName="text-gray-5" />}
        count={detail.metrics.viewCount}
      />
      <MetricItem
        icon={<ChatBubbleIcon width={16} height={16} colorClassName="text-gray-5" />}
        count={detail.metrics.commentCount}
      />
      {canNudge && <TodoDetailNudgeAction detail={detail} />}
    </HStack>
  );
}

function TodoDetailNudgeAction({ detail }: TodoDetailSectionProps) {
  const { t } = useTranslation('todo');
  const limitQuery = useQuery(useGetTodoNudgeLimitQueryOptions());

  return (
    <TodoNudgeButton
      receiver={{
        id: detail.owner.id,
        displayName: detail.owner.name ?? t('detail.unknownOwner'),
      }}
      todo={detail.todo}
      isLimitReached={limitQuery.data ? TodoNudgePolicy.isLimitReached(limitQuery.data) : false}
      isDisabled={limitQuery.isPending}
    />
  );
}

function MetricItem({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <HStack gap={4} align="center">
      {icon}
      <Text size="e1" shade={5}>
        {count}
      </Text>
    </HStack>
  );
}

TodoDetailCard.Loading = function Loading() {
  return (
    <VStack gap={14}>
      <HStack gap={10} align="center">
        <Skeleton className="size-11 rounded-full" />
        <VStack gap={6}>
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </VStack>
      </HStack>
      <Skeleton className="h-6 w-4/5 rounded" />
      <Skeleton className="ml-8 h-5 w-3/5 rounded" />
      <Skeleton className="h-3 w-28 rounded" />
    </VStack>
  );
};
