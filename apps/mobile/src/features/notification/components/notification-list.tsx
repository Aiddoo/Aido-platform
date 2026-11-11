import { useLogger } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { createCheerMessageReportTarget } from '@src/features/social/moderation/domains/user-report.model';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
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
import { NotificationPolicy } from '../domains/notification.model';
import type { Notification } from '../domains/notification.model';
import {
  useOpenNotificationDestination,
  useResolveNotificationDestination,
} from '../hooks/use-notification-destination';
import { useNotificationCategory } from '../hooks/use-notification-params';
import { refreshNotifications } from '../queries/notification-cache';
import { useMarkAsReadMutationOptions } from '../queries/notification.mutations';
import { useGetNotificationsInfiniteQueryOptions } from '../queries/notification.queries';
import type { NotificationDestination } from '../utils/notification-destination';
import { getNotificationLabelKey } from '../utils/notification.view-model';
import { NotificationListRow } from './notification-list-row';

const NOTIFICATION_PAGE_SIZE = 10;

export function NotificationList() {
  const [category] = useNotificationCategory();
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const {
    data: listItems,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(
    useGetNotificationsInfiniteQueryOptions({
      category,
      limit: NOTIFICATION_PAGE_SIZE,
      todayDateKey: currentLocalDateKey,
      timeZone: currentTimeZone,
    }),
  );
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshNotifications(queryClient));
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
  const { receivedCheer } = notification;
  const handlePress = useSingleTap(() => onOpen(notification));

  // 받은 응원은 길게 눌러(스크린리더는 동작 메뉴로) 메시지를 신고한다
  const handleReportCheer =
    receivedCheer == null
      ? undefined
      : () => {
          const target = createCheerMessageReportTarget(receivedCheer);
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
      label={t(`categories.${getNotificationLabelKey(notification.type)}`)}
      title={notification.title}
      body={notification.body}
      createdAt={notification.createdAt}
      isUnread={NotificationPolicy.isUnread(notification)}
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
  const resolveDestination = useResolveNotificationDestination();
  const openDestination = useOpenNotificationDestination();
  const logger = useLogger();
  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const { trackEvent } = useTrack();
  const gate = useEntitlementGate('AI_REPORT', { surface: 'notification_center' });

  return (notification: Notification) => {
    if (NotificationPolicy.isUnread(notification)) {
      markAsRead(notification.id);
    }

    if (
      NotificationPolicy.isAiFeature(notification) &&
      gate.promptIfBlocked({ description: t('list.premiumDescription') })
    ) {
      return;
    }

    // 목록은 알림함 화면에만 있어, 알림함을 여는 알림은 같은 화면을 다시 열지 않고 머문다
    const destination: NotificationDestination =
      notification.target.kind === 'NOTIFICATIONS'
        ? { kind: 'none' }
        : resolveDestination(notification.target);
    trackEvent('notification_center_opened', {
      type: notification.type,
      destination: destination.kind,
    });
    openDestination(destination).catch((error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.CENTER_NAVIGATION_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };
}
