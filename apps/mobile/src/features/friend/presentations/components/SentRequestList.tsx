import { FlashList } from '@shopify/flash-list';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DocsIcon, Flex, HStack, Result, Text, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton } from 'heroui-native';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import type { FriendRequest } from '../../models/friend.model';
import { useCancelRequestMutationOptions } from '../queries/use-cancel-request-mutation-options';
import { useGetSentRequestsQueryOptions } from '../queries/use-get-sent-requests-query-options';
import { FriendRequestRow } from './FriendRequestRow';

export function SentRequestList() {
  const { t } = useTranslation(['friend', 'common']);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(useGetSentRequestsQueryOptions());
  const cancelMutation = useMutation(useCancelRequestMutationOptions());
  const [isRefreshing, handleRefresh] = useRefresh(refetch);

  const allRequests = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  return (
    <FlashList
      ListHeaderComponent={
        <Box py={12}>
          <Text size="b4" shade={6}>
            {t('list.requestCount', { count: totalCount })}
          </Text>
        </Box>
      }
      data={allRequests}
      renderItem={({ item }: { item: FriendRequest }) => {
        const isProcessing = cancelMutation.isPending && cancelMutation.variables === item.id;

        return (
          <FriendRequestRow
            user={item}
            actions={
              <Button
                variant="weak"
                color="danger"
                size="small"
                display="inline"
                onPress={() => cancelMutation.mutate(item.id)}
                disabled={isProcessing}
              >
                {t('common:actions.cancel')}
              </Button>
            }
          />
        );
      }}
      ListEmptyComponent={
        <Flex flex={1} justify="center" align="center">
          <Result icon={<DocsIcon width={72} height={72} />} title={t('list.emptySent')} />
        </Flex>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <Flex py={16} align="center">
            <ActivityIndicator />
          </Flex>
        ) : null
      }
      keyExtractor={(item) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#FF6B43"
          colors={['#FF6B43']}
        />
      }
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
    />
  );
}

SentRequestList.Loading = function Loading() {
  return (
    <ScrollView className="flex-1 px-4">
      <Box py={12}>
        <Skeleton className="w-16 h-4" />
      </Box>
      <VStack>
        {times(3, (i) => (
          <HStack key={i} align="center" className="py-2" gap={12}>
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="flex-1 h-5" />
            <Skeleton className="w-12 h-8 rounded" />
          </HStack>
        ))}
      </VStack>
    </ScrollView>
  );
};
