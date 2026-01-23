import { FlashList } from '@shopify/flash-list';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { DocsIcon } from '@src/shared/ui/Icon';
import { Result } from '@src/shared/ui/Result/Result';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import type { FriendRequestUser } from '../../models/friend-request.model';
import { cancelRequestMutationOptions } from '../queries/cancel-request-mutation-options';
import { getSentRequestsQueryOptions } from '../queries/get-sent-requests-query-options';
import { FriendRequestRow } from './FriendRequestRow';

const SentRequestListComponent = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    getSentRequestsQueryOptions(),
  );
  const cancelMutation = useMutation(cancelRequestMutationOptions());

  const allRequests = data.pages.flatMap((page) => page.requests);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  return (
    <FlashList
      ListHeaderComponent={
        <View className="py-3">
          <Text size="b4" shade={6}>
            총 {totalCount}개 요청
          </Text>
        </View>
      }
      data={allRequests}
      renderItem={({ item }: { item: FriendRequestUser }) => {
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
                취소
              </Button>
            }
          />
        );
      }}
      ListEmptyComponent={
        <View className="flex-1 justify-center items-center">
          <Result icon={<DocsIcon width={72} height={72} />} title="아직 보낸 요청이 없어요" />
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="py-4 items-center">
            <ActivityIndicator />
          </View>
        ) : null
      }
      keyExtractor={(item) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
    />
  );
};

const SentRequestListLoading = () => (
  <ScrollView className="flex-1 px-4">
    <View className="py-3">
      <Skeleton className="w-16 h-4" />
    </View>
    <VStack>
      {[1, 2, 3].map((i) => (
        <HStack key={i} align="center" className="py-2" gap={12}>
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="flex-1 h-5" />
          <Skeleton className="w-12 h-8 rounded" />
        </HStack>
      ))}
    </VStack>
  </ScrollView>
);

export const SentRequestList = Object.assign(SentRequestListComponent, {
  Loading: SentRequestListLoading,
});
