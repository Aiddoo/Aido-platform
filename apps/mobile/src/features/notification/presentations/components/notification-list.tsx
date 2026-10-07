import type { NotificationCategory } from '@aido/api';
import { FlashList } from '@shopify/flash-list';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useToday } from '@src/shared/hooks/useToday';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  NotiIcon,
  Result,
  Text,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { Separator, Skeleton, Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { useGetNotificationsInfiniteQueryOptions } from '../queries/get-notifications-infinite-query-options';
import { toNotificationListItems } from '../view-models/notification-list.view-model';
import { NotificationItem } from './notification-item';

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
      ListFooterComponent={
        query.isFetchNextPageError ? (
          <Box p={16}>
            <Button variant="weak" onPress={() => void query.fetchNextPage()}>
              {t('common:actions.retry')}
            </Button>
          </Box>
        ) : query.isFetchingNextPage ? (
          <Box py={24}>
            <Spinner size="lg" />
          </Box>
        ) : null
      }
      ItemSeparatorComponent={() => <Separator className="mx-4" />}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          void query.fetchNextPage({ cancelRefetch: false });
        }
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
    />
  );
}

NotificationList.Item = function Item(props: ComponentProps<typeof NotificationItem>) {
  return <NotificationItem {...props} />;
};

NotificationList.Empty = function Empty() {
  const { t } = useTranslation('notification');
  return (
    <VStack flex={1} p={24}>
      <Result icon={<NotiIcon width={72} height={72} />} title={t('list.empty')} />
    </VStack>
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

NotificationList.Loading = function Loading() {
  return (
    <ScrollView className="flex-1">
      <Box px={16} py={8}>
        <Skeleton className="w-32 h-5" />
      </Box>
      <VStack>
        {times(5, (index) => (
          <Box key={index} px={16} py={16}>
            <VStack gap={4}>
              <HStack justify="between">
                <Skeleton className="w-10 h-4" />
                <Skeleton className="w-12 h-4" />
              </HStack>
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-full h-4" />
            </VStack>
          </Box>
        ))}
      </VStack>
    </ScrollView>
  );
};
