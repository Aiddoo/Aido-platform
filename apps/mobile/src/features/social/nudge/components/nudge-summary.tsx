import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { formatRelativeTimeLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import { NudgeInteractionPolicy } from '../domains/nudge-interaction.model';
import { useNudgeId } from '../hooks/use-nudge-id';
import { useGetNudgeInteractionQueryOptions } from '../queries/todo-nudge.queries';

export function NudgeSummary() {
  const [nudgeId] = useNudgeId();
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const now = useMinuteNow();
  const [{ data: nudge }, { data: me }] = useSuspenseQueries({
    queries: [useGetNudgeInteractionQueryOptions({ nudgeId }), useGetMeQueryOptions()],
  });
  const isReceived = NudgeInteractionPolicy.isReceivedBy(nudge, me.id);
  const counterpart = isReceived
    ? { name: nudge.senderName, profileImage: nudge.senderProfileImage }
    : { name: nudge.receiverName, profileImage: nudge.receiverProfileImage };

  return (
    <VStack gap={24}>
      <HStack gap={12} align="center">
        <UserAvatar
          alt={counterpart.name}
          className="size-12"
          profileImage={counterpart.profileImage}
        />
        <VStack flex={1} gap={4}>
          <Text size="b3" weight="semibold">
            {t(isReceived ? 'interaction.from' : 'interaction.to', { name: counterpart.name })}
          </Text>
          <Text size="e1" shade={5}>
            {formatRelativeTimeLabel(nudge.createdAt, now, dateFormatContext)}
          </Text>
        </VStack>
      </HStack>

      <VStack gap={8}>
        <Text size="t3" weight="bold">
          {t('interaction.encouragementTitle')}
        </Text>
        {nudge.message != null && (
          <Text size="b3" shade={6}>
            {nudge.message}
          </Text>
        )}
      </VStack>
    </VStack>
  );
}

NudgeSummary.Loading = function Loading() {
  return (
    <VStack gap={24}>
      <HStack gap={12} align="center">
        <Skeleton className="size-12 rounded-full" />
        <VStack flex={1} gap={4}>
          <TextSkeleton size="b3" className="w-40" />
          <TextSkeleton size="e1" className="w-16" />
        </VStack>
      </HStack>

      <TextSkeleton size="t3" className="w-3/4" />
    </VStack>
  );
};
