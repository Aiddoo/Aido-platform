import { NudgeThanksButton } from '@src/features/nudge/components/nudge-interactions/nudge-thanks-button';
import { TodoNudgeButton } from '@src/features/nudge/components/todo-nudge-button';
import { NudgeInteractionPolicy } from '@src/features/nudge/domains/nudge-interaction.model';
import { TodoNudgePolicy } from '@src/features/nudge/domains/todo-nudge.model';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { ChatBubbleIcon, EyeIcon, HStack, Text, VStack } from '@src/shared/ui';
import { formatFullDate } from '@src/shared/utils/date';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { TodoDetails } from '../domains/todo.model';
import { useTodoScreenParams } from '../hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '../queries/get-todo-details-query-options';
import { SubTodoIndent } from './sub-todo-indent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './todo-row';

export function TodoDetailCard() {
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return (
    <VStack gap={14}>
      <TodoOwnerLine detail={detail} />
      <TodoBody detail={detail} />
      <TodoMetricLine detail={detail} />
      <TodoDetailThanksAction detail={detail} />
    </VStack>
  );
}

type TodoDetailSectionProps = { detail: TodoDetails };

function TodoOwnerLine({ detail }: TodoDetailSectionProps) {
  const { t } = useTranslation('todo');
  const ownerName = detail.owner.name ?? t('detail.unknownOwner');

  return (
    <HStack gap={10} align="center">
      <UserAvatar alt={ownerName} className="size-11" profileImage={detail.owner.profileImage} />
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
          todo.subTodos.length > 0 && (
            <TodoProgress value={todo.subTodoStats.completed} total={todo.subTodoStats.total} />
          )
        }
      />

      {todo.subTodos.length > 0 && (
        <SubTodoIndent>
          {todo.subTodos.map((item) => (
            <TodoRow
              key={item.id}
              left={<TodoCheckbox isSelected={item.completed} />}
              top={<TodoLabel isChecked={item.completed}>{item.title}</TodoLabel>}
            />
          ))}
        </SubTodoIndent>
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

  return (
    <TodoNudgeButton
      receiver={{
        id: detail.owner.id,
        displayName: detail.owner.name ?? t('detail.unknownOwner'),
      }}
      todo={detail.todo}
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

function TodoDetailThanksAction({ detail }: TodoDetailSectionProps) {
  const { data: me } = useQuery(useGetMeQueryOptions());
  return NudgeInteractionPolicy.isThankableTodo(detail.todo, {
    isOwner: me?.id === detail.owner.id,
  }) ? (
    <NudgeThanksButton todoId={detail.todo.id} />
  ) : null;
}
