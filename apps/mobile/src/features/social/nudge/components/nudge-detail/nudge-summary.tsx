import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { formatRelativeTimeLabel } from '@src/shared/date/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';

import { NudgeInteractionPolicy } from '../../domains/nudge-interaction.model';
import { useNudgeId } from '../../hooks/use-nudge-id';
import { useGetNudgeInteractionQueryOptions } from '../../queries/nudge.queries';

export function NudgeSummary() {
  const [nudgeId] = useNudgeId();
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const now = useMinuteNow();
  const [{ data: nudge }, { data: me }] = useSuspenseQueries({
    queries: [useGetNudgeInteractionQueryOptions({ nudgeId }), useGetMeQueryOptions()],
  });
  const isReceived = NudgeInteractionPolicy.isReceivedBy(nudge, me.id);

  return (
    <VStack gap={24}>
      <HStack gap={12} align="center">
        <UserAvatar
          alt={isReceived ? nudge.senderName : nudge.receiverName}
          className="size-12"
          profileImage={isReceived ? nudge.senderProfileImage : nudge.receiverProfileImage}
        />
        <VStack flex={1} gap={4}>
          <Text size="b3" weight="semibold">
            {t(isReceived ? 'interaction.from' : 'interaction.to', {
              name: isReceived ? nudge.senderName : nudge.receiverName,
            })}
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
