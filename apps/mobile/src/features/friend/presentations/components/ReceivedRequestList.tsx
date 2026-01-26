import { FlashList } from '@shopify/flash-list';
import { Box } from '@src/shared/ui/Box/Box';
import { Button } from '@src/shared/ui/Button/Button';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { DocsIcon } from '@src/shared/ui/Icon';
import { Result } from '@src/shared/ui/Result/Result';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton, useToast } from 'heroui-native';
import { ActivityIndicator, ScrollView } from 'react-native';
import type { FriendRequestUser } from '../../models/friend.model';
import { acceptRequestMutationOptions } from '../queries/accept-request-mutation-options';
import { getReceivedRequestsQueryOptions } from '../queries/get-received-requests-query-options';
import { rejectRequestMutationOptions } from '../queries/reject-request-mutation-options';
import { FriendRequestRow } from './FriendRequestRow';

const ReceivedRequestListComponent = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    getReceivedRequestsQueryOptions(),
  );
  const acceptMutation = useMutation(acceptRequestMutationOptions());
  const rejectMutation = useMutation(rejectRequestMutationOptions());
  const { toast } = useToast();

  const handleAccept = (userId: string) => {
    acceptMutation.mutate(userId, {
      onSuccess: () => {
        toast.show({
          label: '친구 요청을 수락했어요',
          actionLabel: '닫기',
          onActionPress: ({ hide }) => hide(),
        });
      },
    });
  };

  const handleReject = (userId: string) => {
    rejectMutation.mutate(userId, {
      onSuccess: () => {
        toast.show({
          label: '친구 요청을 거절했어요',
          actionLabel: '닫기',
          onActionPress: ({ hide }) => hide(),
        });
      },
    });
  };

  const allRequests = data.pages.flatMap((page) => page.requests);
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
      renderItem={({ item }: { item: FriendRequestUser }) => {
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
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
    />
  );
};

const ReceivedRequestListLoading = () => (
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

export const ReceivedRequestList = Object.assign(ReceivedRequestListComponent, {
  Loading: ReceivedRequestListLoading,
});
