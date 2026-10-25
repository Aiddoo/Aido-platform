import { ThanksSummaryRow } from '@src/features/nudge/components/nudge-interactions/thanks-summary-row';
import { TodoNudgeButton } from '@src/features/nudge/components/todo-nudge-button';
import { NudgeInteractionPolicy } from '@src/features/nudge/domains/nudge-interaction.model';
import { TodoNudgePolicy } from '@src/features/nudge/domains/todo-nudge.model';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ChatBubbleIcon,
  EyeIcon,
  HStack,
  QueryErrorBoundary,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { formatDateKeyLabel } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense } from 'react';

import type { TodoDetails } from '../domains/todo.model';
import { useTodoScreenParams } from '../hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '../queries/get-todo-details-query-options';
import { todoThanksSheetHref } from '../utils/navigation/todo-sheet-href';
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
      <TodoDetailThanksSummary detail={detail} />
    </VStack>
  );
}

type TodoDetailSectionProps = { detail: TodoDetails };

function TodoOwnerLine({ detail }: TodoDetailSectionProps) {
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const ownerName = detail.owner.name ?? t('detail.unknownOwner');

  return (
    <HStack gap={10} align="center">
      <UserAvatar alt={ownerName} className="size-11" profileImage={detail.owner.profileImage} />
      <VStack flex={1} gap={2} className="min-w-0">
        <Text size="b3" weight="semibold">
          {ownerName}
        </Text>
        <Text size="e1" shade={5}>
          {formatDateKeyLabel(detail.todo.startDate, 'fullDate', dateFormatContext)}
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
        <VStack flex={1} gap={2} className="min-w-0">
          <TextSkeleton size="b3" className="w-24" />
          <TextSkeleton size="e1" className="w-16" />
        </VStack>
      </HStack>
      <TodoRow
        left={<Skeleton className="size-5 rounded-md" />}
        top={<TextSkeleton size="b3" className="w-4/5" />}
      />
      <HStack gap={16} align="center">
        {times(2, (index) => (
          <HStack key={index} gap={4} align="center">
            <Skeleton className="size-4 rounded-full" />
            <TextSkeleton size="e1" className="w-4" />
          </HStack>
        ))}
      </HStack>
    </VStack>
  );
};

function TodoDetailThanksSummary({ detail }: TodoDetailSectionProps) {
  const push = useSingleTap(router.push);
  const isThankable = NudgeInteractionPolicy.isThankableTodo(detail.todo, {
    isOwner: detail.permissions.canEdit,
  });
  if (!isThankable) {
    return null;
  }

  return (
    <QueryErrorBoundary resetKeys={[detail.todo.id]} fallback={() => null}>
      <Suspense fallback={<ThanksSummaryRow.Loading />}>
        <ThanksSummaryRow
          todoId={detail.todo.id}
          onThanksPress={() => push(todoThanksSheetHref({ todoId: detail.todo.id }))}
        />
      </Suspense>
    </QueryErrorBoundary>
  );
}
