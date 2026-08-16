import type { TodoDetailsResponse } from '@aido/validators';
import { useTodoDetailsQueryOptions } from '@src/features/todo/presentations/queries/use-todo-page-query-options';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { Avatar, CheckboxIcon, FillCheckIcon, HStack, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';

import { useCommentThreadParams } from '../hooks/use-comment-thread-params';
import { THREAD_COLUMN_WIDTH, ThreadConnectorDown } from './ThreadLine';

/** 이 대화가 어떤 할 일에 달렸는지만 알면 되므로, 하위 항목은 앞의 몇 개만 보여준다. */
const VISIBLE_CHECKLIST_SIZE = 3;

/**
 * 스레드 화면 맨 위의 원본 할 일.
 * 아래 원본 댓글까지 줄기가 이어져, 이 대화가 어디서 시작됐는지 한눈에 읽힌다.
 * 누르면 할 일 상세로 돌아간다 — 스택에 이미 있으면 그 화면으로 되돌아간다.
 */
export function ThreadTodoCard() {
  const { t } = useTranslation('todoComment');
  const { todoId } = useCommentThreadParams();
  const navigate = useSingleTap(router.navigate);

  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const ownerName = detail.owner.name ?? t('list.unknownUser');

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={t('thread.openTodo')}
      onPress={() => navigate({ pathname: '/todo/[todoId]', params: { todoId } })}
    >
      <VStack px={16} pt={14}>
        <Text size="e2" shade={5} weight="semibold">
          {t('thread.originLabel')}
        </Text>

        <HStack pt={8} gap={10} className="relative">
          {/* 이 아바타에서 카드 바닥까지 내려가, 바로 아래 댓글의 아바타와 이어진다. */}
          <ThreadConnectorDown />

          <VStack className={THREAD_COLUMN_WIDTH}>
            <Avatar alt={ownerName} className="size-9">
              <Avatar.Image source={getProfileIconSource(detail.owner.profileImage)} />
            </Avatar>
          </VStack>

          <VStack flex={1} pb={14} gap={6}>
            <Text size="b4" weight="semibold">
              {ownerName}
            </Text>

            <Text size="b2" weight="bold" maxLines={2}>
              {detail.todo.title}
            </Text>

            <ThreadTodoChecklist detail={detail} />
          </VStack>
        </HStack>
      </VStack>
    </PressableFeedback>
  );
}

/** 원본 할 일의 하위 항목. 앞의 몇 개만 보여주고 나머지는 개수로 알린다. */
function ThreadTodoChecklist({ detail }: { detail: TodoDetailsResponse }) {
  const { t } = useTranslation('todoComment');
  const { items, itemStats } = detail.todo;

  if (items.length === 0) {
    return null;
  }

  const hiddenCount = items.length - VISIBLE_CHECKLIST_SIZE;

  return (
    <VStack pt={2} gap={7}>
      {items.slice(0, VISIBLE_CHECKLIST_SIZE).map((item) => (
        <HStack key={item.id} gap={8} align="center">
          {item.completed ? (
            <FillCheckIcon width={18} height={18} colorClassName="text-main" />
          ) : (
            <CheckboxIcon width={18} height={18} colorClassName="text-gray-4" />
          )}
          <Text
            size="b3"
            shade={item.completed ? 5 : 9}
            strikethrough={item.completed}
            maxLines={1}
            className="flex-1"
          >
            {item.title}
          </Text>
        </HStack>
      ))}

      {hiddenCount > 0 && (
        <Text size="e1" shade={5}>
          {t('thread.moreChecklistItems', { count: hiddenCount })}
        </Text>
      )}

      <Text size="e1" shade={5}>
        {t('thread.checklistProgress', {
          completed: itemStats.completed,
          total: itemStats.total,
        })}
      </Text>
    </VStack>
  );
}

ThreadTodoCard.Loading = function Loading() {
  return (
    <VStack px={16} pt={14} pb={14} gap={10}>
      <Skeleton className="h-3 w-16 rounded" />
      <HStack gap={10}>
        <Skeleton className="size-9 rounded-full" />
        <VStack flex={1} gap={7}>
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-6 w-4/5 rounded" />
          <Skeleton className="h-4 w-3/5 rounded" />
        </VStack>
      </HStack>
    </VStack>
  );
};
