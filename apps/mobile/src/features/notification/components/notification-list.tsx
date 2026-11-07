import { useLogger } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { UserReportPolicy } from '@src/features/social/moderation/domains/user-report.model';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  InfiniteList,
  NotiIcon,
  QueryErrorActions,
  Result,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useMutation, useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import { NOTIFICATION_TYPE_LABEL_KEYS } from '../constants/notification-labels';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NotificationPolicy } from '../domains/notification.model';
import { useNotificationCategory } from '../hooks/use-notification-category';
import { useNotificationNavigation } from '../hooks/use-notification-navigation';
import { useMarkAsReadMutationOptions } from '../queries/notification.mutations';
import { useGetNotificationsInfiniteQueryOptions } from '../queries/notification.queries';
import type { Notification } from '../schemas/notification.schema';
import { toDateSectionedListItems } from '../utils/date-section';
import { resolveNotificationDestination } from '../utils/notification-destination';
import { NotificationListRow } from './notification-list-row';

const NOTIFICATION_PAGE_SIZE = 10;

export function NotificationList() {
  const [category] = useNotificationCategory();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
    useSuspenseInfiniteQuery(
      useGetNotificationsInfiniteQueryOptions({ category, limit: NOTIFICATION_PAGE_SIZE }),
    );
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const listItems = toDateSectionedListItems(data, currentLocalDateKey, currentTimeZone);
  const [isRefreshing, handleRefresh] = useRefresh(refetch);

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
          .with({ type: 'item' }, ({ entry }) => <NotificationList.Item notification={entry} />)
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
      <Result
        title={t('notification:list.loadError')}
        button={<QueryErrorActions onRetry={reset} />}
      />
    </VStack>
  );
};

NotificationList.Empty = function Empty() {
  const { t } = useTranslation('notification');

  return (
    <VStack flex={1} p={24}>
      <Result icon={<NotiIcon width={72} height={72} />} title={t('list.empty')} />
    </VStack>
  );
};

interface NotificationItemProps {
  notification: Notification;
}

NotificationList.Item = function Item({ notification }: NotificationItemProps) {
  const handlePress = useSingleTap(useNotificationPress(notification));
  const push = useSingleTap(router.push);
  const { t } = useTranslation(['notification', 'moderation']);
  const receivedCheer = NotificationPolicy.findReceivedCheer(notification);

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
      label={t(`categories.${NOTIFICATION_TYPE_LABEL_KEYS[notification.type]}`)}
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

function useNotificationPress(notification: Notification) {
  const navigateToDestination = useNotificationNavigation();
  const today = useTodayKey();
  const windowSizeClass = useWindowSizeClass();
  const logger = useLogger();

  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const gate = useEntitlementGate('AI_REPORT', { surface: 'notification_center' });

  return useCallback(() => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (
      NotificationPolicy.isAiFeature(notification) &&
      gate.promptIfBlocked({ description: tGlobal('notification:list.premiumDescription') })
    ) {
      return;
    }

    const destination = resolveNotificationDestination(
      {
        type: notification.type,
        context: notification.context,
        routing: notification.routing,
        action: notification.action,
      },
      { today, windowSizeClass, viewerId: getCachedMe(queryClient)?.id },
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
  }, [
    notification,
    markAsRead,
    trackEvent,
    queryClient,
    gate,
    navigateToDestination,
    today,
    windowSizeClass,
    logger,
  ]);
}
