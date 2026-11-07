import { useTranslation } from '@src/shared/i18n';
import { BellFilledIcon, HStack, Text, TextButton } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Card } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useMarkAllAsReadMutationOptions } from '../queries/notification.mutations';
import { useGetUnreadCountQueryOptions } from '../queries/notification.queries';

type UnreadNotificationCardProps = Omit<ComponentProps<typeof Card>, 'children'>;

export function UnreadNotificationCard(props: UnreadNotificationCardProps) {
  const { data: unreadCount = 0 } = useSuspenseQuery(useGetUnreadCountQueryOptions());
  const markAllAsRead = useMutation(useMarkAllAsReadMutationOptions());
  const { t } = useTranslation('notification');

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Card {...props}>
      <HStack align="center" justify="between">
        <HStack align="center" gap={8}>
          <BellFilledIcon width={18} height={18} colorClassName="text-main" />
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
