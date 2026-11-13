import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { BellFilledIcon, HStack, Text, TextButton } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Card } from 'heroui-native';
import type { ComponentProps } from 'react';

import { NotificationBadgePolicy } from '../domains/notification-badge.model';
import { useMarkAllAsReadMutationOptions } from '../queries/notification.mutations';
import { useGetUnreadCountQueryOptions } from '../queries/notification.queries';

type UnreadNotificationCardProps = Omit<ComponentProps<typeof Card>, 'children'>;

export function UnreadNotificationCard(props: UnreadNotificationCardProps) {
  const { data: unreadCount } = useSuspenseQuery(useGetUnreadCountQueryOptions());
  const markAllAsRead = useMutation(useMarkAllAsReadMutationOptions());
  const { t } = useTranslation('notification');
  const fontScaledSize = useFontScaledSize();

  if (!NotificationBadgePolicy.hasUnread(unreadCount)) {
    return null;
  }

  return (
    <Card {...props}>
      <HStack align="center" justify="between">
        <HStack align="center" gap={8}>
          <BellFilledIcon
            width={fontScaledSize(18)}
            height={fontScaledSize(18)}
            colorClassName="text-main"
          />
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
