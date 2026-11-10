import { useLogger } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { UserReportPolicy } from '@src/features/social/moderation/domains/user-report.model';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  InfiniteList,
  NotificationIllustration,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { match } from 'ts-pattern';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_TYPE_TRAITS } from '../constants/notification.constants';
import { NotificationPolicy } from '../domains/notification.model';
import type { Notification } from '../domains/notification.model';
import { useNotificationCategory } from '../hooks/use-notification-category';
import { useNotificationNavigation } from '../hooks/use-notification-navigation';
import { invalidateNotifications } from '../queries/notification-cache';
import { useMarkAsReadMutationOptions } from '../queries/notification.mutations';
import { useGetNotificationsInfiniteQueryOptions } from '../queries/notification.queries';
import { toDateSectionedListItems } from '../utils/date-section';
import { resolveNotificationDestination } from '../utils/notification-destination';
import { NotificationListRow } from './notification-list-row';

const NOTIFICATION_PAGE_SIZE = 10;

export function NotificationList() {
  const [category] = useNotificationCategory();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
    useSuspenseInfiniteQuery(
      useGetNotificationsInfiniteQueryOptions({ category, limit: NOTIFICATION_PAGE_SIZE }),
    );
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const listItems = toDateSectionedListItems(data, currentLocalDateKey, currentTimeZone);
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateNotifications(queryClient));
  const openNotification = useOpenNotification();

  return (
    <InfiniteList
      data={listItems}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      renderItem={({ item }) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => (
            <NotificationListRow.SectionHeader section={section} />
          ))
          .with({ type: 'item' }, ({ entry }) => (
            <NotificationList.Item notification={entry} onOpen={openNotification} />
          ))
          .exhaustive()
      }
      getItemType={(item) => item.type}
      keyExtractor={(item) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => `header-${section}`)
          .with({ type: 'item' }, ({ entry }) => String(entry.id))
          .exhaustive()
      }
      ListEmptyComponent={<NotificationList.Empty />}
      ItemSeparatorComponent={() => <Separator className="mx-4" />}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
    />
  );
}

NotificationList.Loading = NotificationListRow.Loading;

NotificationList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['notification', 'common']);

  return (
    <VStack flex={1} p={24}>
      <QueryErrorFallback title={t('notification:list.loadError')} reset={reset} />
    </VStack>
  );
};

NotificationList.Empty = function Empty() {
  const { t } = useTranslation('notification');

  return (
    <VStack flex={1} p={24}>
      <Result icon={<NotificationIllustration />} title={t('list.empty')} />
    </VStack>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}

NotificationList.Item = function Item({ notification, onOpen }: NotificationItemProps) {
  const { t } = useTranslation(['notification', 'moderation']);
  const push = useSingleTap(router.push);
  const receivedCheer = NotificationPolicy.findReceivedCheer(notification);
  const handlePress = useSingleTap(() => onOpen(notification));

  // 받은 응원은 길게 눌러(스크린리더는 동작 메뉴로) 메시지를 신고한다
  const handleReportCheer =
    receivedCheer == null
      ? undefined
      : () => {
          const target = UserReportPolicy.createCheerMessageReportTarget(receivedCheer);
          push({
            pathname: '/users/[userId]/report',
            params: {
              userId: target.targetUserId,
              name: receivedCheer.senderName ?? t('moderation:fallbackName'),
              targetType: target.targetType,
              targetId: target.targetId,
            },
          });
        };

  return (
    <NotificationListRow
      label={t(`categories.${NOTIFICATION_TYPE_TRAITS[notification.type].labelKey}`)}
      title={notification.title}
      body={notification.body}
      createdAt={notification.createdAt}
      isUnread={!notification.isRead}
      testID={`notification-item-${notification.type}`}
      onPress={handlePress}
      onLongPress={handleReportCheer}
      accessibilityActions={
        handleReportCheer == null
          ? undefined
          : [{ name: 'report', label: t('moderation:menu.reportCheer') }]
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'report') {
          handleReportCheer?.();
        }
      }}
    />
  );
};

// 목록이 한 번 부르고 행에 넘겨 행마다 게이트·mutation을 만들지 않는다
function useOpenNotification() {
  const { t } = useTranslation('notification');
  const navigateToDestination = useNotificationNavigation();
  const windowSizeClass = useWindowSizeClass();
  const logger = useLogger();
  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const gate = useEntitlementGate('AI_REPORT', { surface: 'notification_center' });

  return (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (
      NotificationPolicy.isAiFeature(notification) &&
      gate.promptIfBlocked({ description: t('list.premiumDescription') })
    ) {
      return;
    }

    const destination = resolveNotificationDestination(
      {
        type: notification.type,
        context: notification.context,
        routing: notification.routing,
        action: notification.action,
        navigation: notification.navigation,
      },
      { shouldOpenToday: true, windowSizeClass, viewerId: getCachedMe(queryClient)?.id },
    );
    trackEvent('notification_center_opened', {
      type: notification.type,
      destination: destination.kind,
    });
    navigateToDestination(destination).catch((error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.CENTER_NAVIGATION_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };
}
