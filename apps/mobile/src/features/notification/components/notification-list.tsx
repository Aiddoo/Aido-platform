import type { NotificationCategory } from '@aido/api';
import { FlashList } from '@shopify/flash-list';
import { useLogger } from '@src/bootstrap/providers/di-context';
import { UserReportPolicy } from '@src/features/moderation/domains/user-report.model';
import { userReportSheetHref } from '@src/features/moderation/utils/navigation/moderation-href';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  Box,
  Button,
  NotiIcon,
  Result,
  usePremiumDialog,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useMutation, useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator, Spinner } from 'heroui-native';
import { useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { type Notification, NotificationPolicy } from '../domains/notification.model';
import { useNotificationNavigation } from '../hooks/use-notification-navigation';
import { useGetNotificationsInfiniteQueryOptions } from '../queries/get-notifications-infinite-query-options';
import { useMarkAsReadMutationOptions } from '../queries/use-mark-as-read-mutation-options';
import { resolveNotificationDestination } from '../utils/navigation/notification-destination';
import { getCategoryKey } from '../utils/view-models/notification-category.view-model';
import { toDateSectionedListItems } from '../utils/view-models/notification-list.view-model';
import { NotificationListRow } from './notification-list-row';

type NotificationListProps = {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
};

export function NotificationList({ category, unreadOnly, limit }: NotificationListProps) {
  const { t } = useTranslation(['notification', 'common']);
  const query = useSuspenseInfiniteQuery(
    useGetNotificationsInfiniteQueryOptions({ category, unreadOnly, limit }),
  );
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const listItems = toDateSectionedListItems(query.data, currentLocalDateKey, currentTimeZone);
  const [isRefreshing, handleRefresh] = useRefresh(query.refetch);
  const { color: refreshTint } = useResolveClassNames('text-main');

  return (
    <FlashList
      data={listItems}
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
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={refreshTint}
          colors={refreshTint == null ? undefined : [refreshTint]}
        />
      }
      ListEmptyComponent={<NotificationList.Empty />}
      ListFooterComponent={match({
        isFetchNextPageError: query.isFetchNextPageError,
        isFetchingNextPage: query.isFetchingNextPage,
      })
        .with({ isFetchNextPageError: true }, () => (
          <Box p={16}>
            <Button variant="weak" onPress={() => query.fetchNextPage()}>
              {t('common:actions.retry')}
            </Button>
          </Box>
        ))
        .with({ isFetchingNextPage: true }, () => (
          <Box py={24}>
            <Spinner size="lg" />
          </Box>
        ))
        .with({ isFetchNextPageError: false, isFetchingNextPage: false }, () => null)
        .exhaustive()}
      ItemSeparatorComponent={() => <Separator className="mx-4" />}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          return query.fetchNextPage({ cancelRefetch: false });
        }
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
    />
  );
}

NotificationList.Loading = NotificationListRow.Loading;

NotificationList.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['notification', 'common']);
  return (
    <VStack flex={1} p={24}>
      <Result
        title={t('notification:list.loadError')}
        button={<Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>}
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
      : () =>
          push(
            userReportSheetHref({
              target: UserReportPolicy.cheerMessageTarget(receivedCheer),
              displayName: receivedCheer.senderName ?? t('moderation:fallbackName'),
            }),
          );

  return (
    <NotificationListRow
      label={t(`categories.${getCategoryKey(notification.type)}`)}
      title={notification.title}
      body={notification.body}
      createdAt={notification.createdAt}
      isUnread={!notification.isRead}
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
  const logger = useLogger();

  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const premiumDialog = usePremiumDialog();

  return useCallback(() => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (NotificationPolicy.isAiFeature(notification)) {
      const user = getCachedMe(queryClient);
      if (user && !UserPolicy.isPremiumUser(user)) {
        trackEvent('premium_gate_shown', { feature: 'ai_report' });
        premiumDialog.open({
          description: tGlobal('notification:list.premiumDescription'),
        });
        return;
      }
    }

    const destination = resolveNotificationDestination(
      {
        type: notification.type,
        context: notification.context,
        routing: notification.routing,
        action: notification.action,
      },
      { today },
    );
    trackEvent('notification_center_opened', {
      type: notification.type,
      destination: destination.kind,
    });
    navigateToDestination(destination).catch((error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.CENTER_NAVIGATION_FAILED, { error }),
    );
  }, [
    notification,
    markAsRead,
    trackEvent,
    queryClient,
    premiumDialog,
    navigateToDestination,
    today,
    logger,
  ]);
}
