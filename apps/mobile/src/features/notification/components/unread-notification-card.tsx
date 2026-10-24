import { useTranslation } from '@src/shared/i18n';
import { BellIcon, HStack, Text, TextButton, TextSkeleton } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Card, Skeleton } from 'heroui-native';

import { useGetUnreadCountQueryOptions } from '../queries/get-unread-count-query-options';
import { useMarkAllAsReadMutationOptions } from '../queries/use-mark-all-as-read-mutation-options';

export function UnreadNotificationCard() {
  const { data: unreadCount = 0 } = useSuspenseQuery(useGetUnreadCountQueryOptions());
  const markAllAsRead = useMutation(useMarkAllAsReadMutationOptions());
  const { t } = useTranslation('notification');

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Card className="mx-4 my-2">
      <HStack align="center" justify="between">
        <HStack align="center" gap={8}>
          <BellIcon width={18} height={18} colorClassName="text-main" />
          <HStack align="baseline" gap={4}>
            <Text size="b3" shade={7} weight="medium">
              {t('list.unreadTitle')}
            </Text>
            <Text size="b3" tone="brand" weight="bold">
              {t('list.unreadCount', { count: unreadCount })}
            </Text>
          </HStack>
        </HStack>

        <TextButton
          size="medium"
          variant="underline"
          onPress={() => markAllAsRead.mutate()}
          isDisabled={markAllAsRead.isPending}
        >
          {t('list.markAllRead')}
        </TextButton>
      </HStack>
    </Card>
  );
}

UnreadNotificationCard.Loading = function Loading() {
  return (
    <Card className="mx-4 my-2">
      <HStack align="center" justify="between">
        <HStack align="center" gap={8}>
          <Skeleton className="size-[18px] rounded" />
          <TextSkeleton size="b3" className="w-36" />
        </HStack>
        <TextSkeleton size="b4" className="w-14" />
      </HStack>
    </Card>
  );
};
