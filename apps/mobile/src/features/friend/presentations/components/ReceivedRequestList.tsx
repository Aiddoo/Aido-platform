import { FlashList } from '@shopify/flash-list';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { Box } from '@src/shared/ui/Box';
import { Button } from '@src/shared/ui/Button/Button';
import { Flex } from '@src/shared/ui/Flex';
import { HStack } from '@src/shared/ui/HStack';
import { DocsIcon } from '@src/shared/ui/Icon';
import { Result } from '@src/shared/ui/Result';
import { Text } from '@src/shared/ui/Text';
import { VStack } from '@src/shared/ui/VStack';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton } from 'heroui-native';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import type { FriendRequest } from '../../models/friend.model';
import { useAcceptRequestMutationOptions } from '../queries/use-accept-request-mutation-options';
import { useGetReceivedRequestsQueryOptions } from '../queries/use-get-received-requests-query-options';
import { useRejectRequestMutationOptions } from '../queries/use-reject-request-mutation-options';
import { FriendRequestRow } from './FriendRequestRow';

export function ReceivedRequestList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(useGetReceivedRequestsQueryOptions());
  const acceptMutation = useMutation(useAcceptRequestMutationOptions());
  const [isRefreshing, handleRefresh] = useRefresh(refetch);
  const rejectMutation = useMutation(useRejectRequestMutationOptions());

  const handleAccept = (userId: string) => {
    acceptMutation.mutate(userId);
  };

  const handleReject = (userId: string) => {
    rejectMutation.mutate(userId);
  };

  const allRequests = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  return (
    <FlashList
      ListHeaderComponent={
        <Box py={12}>
          <Text size="b4" shade={6}>
            총 {totalCount}개 요청
          </Text>
        </Box>
      }
      data={allRequests}
      renderItem={({ item }: { item: FriendRequest }) => {
        const isProcessing =
          (acceptMutation.isPending && acceptMutation.variables === item.id) ||
          (rejectMutation.isPending && rejectMutation.variables === item.id);

        return (
          <FriendRequestRow
            user={item}
            actions={
              <HStack gap={8}>
                <Button
                  variant="weak"
                  color="dark"
                  size="small"
                  display="inline"
                  onPress={() => handleAccept(item.id)}
                  disabled={isProcessing}
                >
                  수락
                </Button>
                <Button
                  variant="weak"
                  color="danger"
                  size="small"
                  display="inline"
                  onPress={() => handleReject(item.id)}
                  disabled={isProcessing}
                >
                  거절
                </Button>
              </HStack>
            }
          />
        );
      }}
      ListEmptyComponent={
        <Flex flex={1} justify="center" align="center">
          <Result icon={<DocsIcon width={72} height={72} />} title="아직 받은 요청이 없어요" />
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

ReceivedRequestList.Loading = function Loading() {
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
            <HStack gap={8}>
              <Skeleton className="w-12 h-8 rounded" />
              <Skeleton className="w-12 h-8 rounded" />
            </HStack>
          </HStack>
        ))}
      </VStack>
    </ScrollView>
  );
};
