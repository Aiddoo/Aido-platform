import type { TodoDetailsResponse } from '@aido/validators';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useTranslation } from '@src/shared/i18n';
import { Avatar, ChatBubbleIcon, EyeIcon, HStack, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import { useTodoScreenParams } from '../hooks/use-todo-screen-params';
import { useTodoDetailsQueryOptions } from '../queries/use-todo-page-query-options';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './TodoRow';

/** 댓글 목록 위에 함께 스크롤되는 할 일 본문. 바깥 여백은 이 카드를 놓는 화면이 정한다. */
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

/** 누가 적은 할 일인지 — 아바타와 이름. */
function TodoOwnerLine({ detail }: TodoDetailSectionProps) {
  const { t } = useTranslation('todo');
  const ownerName = detail.owner.name ?? t('detail.unknownOwner');

  return (
    <HStack gap={10} align="center">
      <Avatar alt={ownerName} className="size-11">
        <Avatar.Image source={getProfileIconSource(detail.owner.profileImage)} />
      </Avatar>
      <VStack gap={2}>
        <Text size="b3" weight="semibold">
          {ownerName}
        </Text>
        <Text size="e1" shade={5}>
          {detail.todo.startDate}
        </Text>
      </VStack>
    </HStack>
  );
}

/**
 * 할 일 본문. 목록에서 보던 그 행을 그대로 쓴다 — 체크박스·라벨·진행도가 같은 프리미티브다.
 * 상위와 하위는 목록과 똑같이 들여쓰기와 세로선으로 갈린다. 여기서는 읽기만 하므로 아무것도 눌리지 않는다.
 */
function TodoBody({ detail }: TodoDetailSectionProps) {
  const { todo } = detail;

  return (
    <VStack>
      <TodoRow
        left={<TodoCheckbox isChecked={todo.completed} />}
        top={<TodoLabel isChecked={todo.completed}>{todo.title}</TodoLabel>}
        middle={
          todo.items.length > 0 ? (
            <TodoProgress value={todo.itemStats.completed} total={todo.itemStats.total} />
          ) : undefined
        }
      />

      {todo.items.length > 0 && (
        <VStack className="ml-8 border-l border-gray-2 pl-4" gap={0}>
          {todo.items.map((item) => (
            <TodoRow
              key={item.id}
              left={<TodoCheckbox isChecked={item.completed} />}
              top={<TodoLabel isChecked={item.completed}>{item.title}</TodoLabel>}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

/** 조회수와 댓글 수. 누르는 곳이 아니라 읽는 줄이다. */
function TodoMetricLine({ detail }: TodoDetailSectionProps) {
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
    </HStack>
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
