import type { NotificationCategory } from '@aido/api';
import { FlashList } from '@shopify/flash-list';
import { useLogger } from '@src/bootstrap/providers/di-context';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday, useTodayKey } from '@src/shared/hooks/use-today';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  ListRow,
  NotiIcon,
  Result,
  Text,
  TextSkeleton,
  usePremiumDialog,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useMutation, useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Separator, Spinner } from 'heroui-native';
import { Fragment, useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { type Notification, NotificationPolicy } from '../domains/notification.model';
import { useNotificationNavigation } from '../hooks/use-notification-navigation';
import { useGetNotificationsInfiniteQueryOptions } from '../queries/get-notifications-infinite-query-options';
import { useMarkAsReadMutationOptions } from '../queries/use-mark-as-read-mutation-options';
import { resolveNotificationDestination } from '../utils/navigation/notification-destination';
import { getCategoryKey } from '../utils/view-models/notification-category.view-model';
import { toNotificationListItems } from '../utils/view-models/notification-list.view-model';

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
  const today = useToday();
  const listItems = toNotificationListItems(query.data, today);
  const [isRefreshing, handleRefresh] = useRefresh(query.refetch);
  const { color: refreshTint } = useResolveClassNames('text-main');

  return (
    <FlashList
      data={listItems}
      renderItem={({ item }) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => (
            <Box px={16} py={8} className="bg-background">
              <Text size="b3" shade={5} weight="semibold">
                {t(`common:dateSections.${section}`)}
              </Text>
            </Box>
          ))
          .with({ type: 'item' }, ({ notification }) => (
            <NotificationList.Item notification={notification} />
          ))
          .exhaustive()
      }
      getItemType={(item) => item.type}
      keyExtractor={(item) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => `header-${section}`)
          .with({ type: 'item' }, ({ notification }) => String(notification.id))
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

NotificationList.Loading = function Loading() {
  return (
    <ScrollView className="flex-1">
      <Box px={16} py={8}>
        <TextSkeleton size="b3" className="w-32" />
      </Box>
      {times(5, (index) => (
        <Fragment key={index}>
          {index > 0 && <Separator className="mx-4" />}
          <ListRow
            horizontalPadding="medium"
            verticalPadding="large"
            contents={
              <VStack gap={3}>
                <HStack justify="between" align="center">
                  <TextSkeleton size="b4" className="w-10" />
                  <TextSkeleton size="b4" className="w-12" />
                </HStack>
                <ListRow.Texts.Loading
                  type="2RowTypeA"
                  topProps={{ className: 'w-3/4' }}
                  bottomProps={{ size: 'b3', className: 'w-full' }}
                />
              </VStack>
            }
          />
        </Fragment>
      ))}
    </ScrollView>
  );
};

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
  const isUnread = !notification.isRead;
  const handlePress = useSingleTap(useNotificationPress(notification));
  const { t } = useTranslation('notification');

  return (
    <Pressable onPress={handlePress}>
      <HStack className={isUnread ? 'bg-highlight' : 'bg-background'}>
        {isUnread && <Box className="w-[3.5px] bg-main self-stretch" />}

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
                  {t(`categories.${getCategoryKey(notification.type)}`)}
                </Text>
                <Text size="b4" shade={5}>
                  {formatRelativeTime(notification.createdAt, new Date())}
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
