import { type User, UserPolicy } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { HStack, ListRow, Text, usePremiumDialog, VStack } from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { type Notification, NotificationPolicy } from '../../models/notification.model';
import { useNotificationNavigation } from '../hooks/use-notification-navigation';
import { useMarkAsReadMutationOptions } from '../queries/use-mark-as-read-mutation-options';

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const isUnread = !notification.isRead;
  const handlePress = useNotificationPress(notification);
  const { t } = useTranslation('notification');

  return (
    <Pressable onPress={handlePress}>
      <HStack className={isUnread ? 'bg-highlight' : 'bg-background'}>
        {isUnread && <View className="w-[3.5px] bg-main self-stretch" />}

        <ListRow
          contents={
            <VStack gap={3}>
              <HStack justify="between" align="center">
                <Text
                  size="b4"
                  tone={isUnread ? 'brand' : 'neutral'}
                  shade={isUnread ? undefined : 5}
                  weight="medium"
                >
                  {t(`categories.${NotificationPolicy.categoryKey(notification)}`)}
                </Text>
                <Text size="b4" shade={5}>
                  {formatRelativeTime(notification.createdAt)}
                </Text>
              </HStack>

              <ListRow.Texts
                type="2RowTypeA"
                top={notification.title}
                topProps={{
                  weight: isUnread ? 'semibold' : 'medium',
                }}
                bottom={notification.body}
                bottomProps={{ size: 'b3', shade: isUnread ? 6 : 5, maxLines: 2 }}
              />
            </VStack>
          }
          className="flex-1 bg-transparent"
          horizontalPadding="medium"
          verticalPadding="large"
        />
      </HStack>
    </Pressable>
  );
}

function useNotificationPress(notification: Notification) {
  const navigateToDestination = useNotificationNavigation();

  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const premiumDialog = usePremiumDialog();

  return useCallback(() => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (NotificationPolicy.isAiFeature(notification)) {
      const user = queryClient.getQueryData<User>(USER_QUERY_KEYS.me());
      if (user && !UserPolicy.isPremiumUser(user)) {
        trackEvent('premium_gate_shown', { feature: 'ai_report' });
        premiumDialog.open({
          description: tGlobal('notification:list.premiumDescription'),
        });
        return;
      }
    }

    const destination = NotificationPolicy.destination(notification);
    trackEvent('notification_center_opened', {
      type: notification.type,
      destination: destination.kind,
    });
    navigateToDestination(destination);
  }, [notification, markAsRead, trackEvent, queryClient, premiumDialog, navigateToDestination]);
}
