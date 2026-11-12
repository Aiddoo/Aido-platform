import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Button,
  HStack,
  PawIcon,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';

import { useNudgeId } from '../../hooks/use-nudge-id';
import { useGetNudgeInteractionQueryOptions } from '../../queries/todo-nudge.queries';

export function NudgeTodoButton() {
  const [nudgeId] = useNudgeId();
  const { t } = useTranslation('todo');
  const { data: nudge } = useSuspenseQuery(useGetNudgeInteractionQueryOptions({ nudgeId }));
  const openTodo = useSingleTap(() =>
    router.navigate({ pathname: '/todo/[todoId]', params: { todoId: nudge.todoId } }),
  );

  return (
    <Button
      variant="weak"
      color="dark"
      isDisabled={nudge.todoTitle == null}
      className="p-4"
      onPress={openTodo}
    >
      <HStack align="center" gap={12} className="w-full">
        <PawIcon width={28} height={28} colorClassName="text-main" />
        <VStack flex={1} gap={4}>
          <Text size="b3" weight="semibold" numberOfLines={3}>
            {nudge.todoTitle ?? t('interaction.unavailableTodo')}
          </Text>
          <Text size="e1" shade={5}>
            {t(nudge.isTodoCompleted ? 'interaction.completed' : 'interaction.openTodo')}
          </Text>
        </VStack>
        <ArrowRightIcon width={18} height={18} colorClassName="text-gray-5" />
      </HStack>
    </Button>
  );
}

NudgeTodoButton.Loading = function Loading() {
  return (
    <HStack gap={12} align="center" p={16}>
      <Skeleton className="size-7 rounded-full" />
      <VStack flex={1} gap={4}>
        <TextSkeleton size="b3" className="w-3/4" />
        <TextSkeleton size="e1" className="w-16" />
      </VStack>
    </HStack>
  );
};
