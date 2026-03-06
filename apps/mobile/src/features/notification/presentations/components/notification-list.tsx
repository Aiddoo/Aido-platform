import { FlashList } from '@shopify/flash-list';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { Box, Flex, NotiIcon, Result, Text, VStack } from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { Separator, Skeleton, Spinner } from 'heroui-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { match } from 'ts-pattern';
import type { NotificationCategory } from '../../models/notification.model';
import { useGetNotificationsInfiniteQueryOptions } from '../queries/use-get-notifications-infinite-query-options';
import { NotificationItem } from './notification-item';

interface NotificationListProps {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
}

export function NotificationList({ category, unreadOnly, limit }: NotificationListProps) {
  const {
    data: listData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useSuspenseInfiniteQuery(
    useGetNotificationsInfiniteQueryOptions({ category, unreadOnly, limit }),
  );

  const [isRefreshing, handleRefresh] = useRefresh(refetch);

  return (
    <View className="flex-1">
      <FlashList
        data={listData}
        renderItem={({ item }) =>
          match(item)
            .with({ type: 'header' }, ({ title }) => (
              <Box px={16} py={8} className="bg-background">
                <Text size="b3" shade={5} weight="semibold">
                  {title}
                </Text>
              </Box>
            ))
            .with({ type: 'item' }, ({ notification }) => (
              <NotificationItem notification={notification} />
            ))
            .exhaustive()
        }
        getItemType={(item) => item.type}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FF6B43"
            colors={['#FF6B43']}
          />
        }
        ListEmptyComponent={
          <Flex flex={1} justify="center" align="center">
            <Result icon={<NotiIcon width={72} height={72} />} title="아직 알림이 없어요" />
          </Flex>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <Flex py={24} justify="center" align="center">
              <Spinner size="lg" color="#FF6B43" />
            </Flex>
          ) : null
        }
        ItemSeparatorComponent={() => <Separator className="ml-[3.5px]" />}
        keyExtractor={(item) =>
          match(item)
            .with({ type: 'header' }, ({ title }) => `header-${title}`)
            .with({ type: 'item' }, ({ notification }) => String(notification.id))
            .exhaustive()
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </View>
  );
}

NotificationList.Loading = function Loading() {
  return (
    <ScrollView className="flex-1">
      <Box px={16} py={12}>
        <Skeleton className="w-32 h-4" />
      </Box>
      <VStack>
        {times(5, (i) => (
          <Box key={i} px={16} py={14}>
            <VStack gap={6}>
              <Skeleton className="w-10 h-3" />
              <Skeleton className="w-3/4 h-4" />
              <Skeleton className="w-full h-3" />
              <Skeleton className="w-16 h-3" />
            </VStack>
          </Box>
        ))}
      </VStack>
    </ScrollView>
  );
};
