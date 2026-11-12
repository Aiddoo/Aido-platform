import {
  USER_LIST_CONTENT_STYLE,
  UserList,
} from '@src/features/identity/user/components/user-list';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  FriendIllustration,
  HStack,
  InfiniteList,
  Text,
  TextSkeleton,
} from '@src/shared/ui';
import { useMutation, useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { FriendRequest } from '../domains/friend.model';
import { refreshFriends } from '../queries/friend-cache';
import {
  useAcceptRequestMutationOptions,
  useRejectRequestMutationOptions,
} from '../queries/friend.mutations';
import { useGetReceivedRequestsInfiniteQueryOptions } from '../queries/friend.queries';

export function ReceivedRequestList() {
  const { t } = useTranslation('friend');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
    useSuspenseInfiniteQuery(useGetReceivedRequestsInfiniteQueryOptions());
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshFriends(queryClient));

  const { items: requests, totalCount } = data;

  return (
    <InfiniteList
      data={requests}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ReceivedRequestList.Item request={item} />}
      contentContainerStyle={USER_LIST_CONTENT_STYLE}
      ListHeaderComponent={
        <Box py={12}>
          <Text size="b4" shade={6}>
            {t('list.requestCount', { count: totalCount })}
          </Text>
        </Box>
      }
      ListEmptyComponent={<ReceivedRequestList.Empty />}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}

ReceivedRequestList.Item = function Item({ request }: { request: FriendRequest }) {
  return (
    <UserList.Item
      displayName={request.name ?? request.userTag}
      profileImage={request.profileImage}
      right={<ReceivedRequestList.Actions key={request.id} requestId={request.id} />}
    />
  );
};

/** 목록이 행을 재활용해도 처리 중 상태가 다른 요청으로 넘어가지 않게 요청마다 새로 만든다 */
ReceivedRequestList.Actions = function Actions({ requestId }: { requestId: string }) {
  const { t } = useTranslation('friend');
  const accept = useMutation(useAcceptRequestMutationOptions());
  const reject = useMutation(useRejectRequestMutationOptions());
  const isProcessing = accept.isPending || reject.isPending;

  return (
    <HStack gap={8}>
      <Button
        variant="weak"
        color="dark"
        size="small"
        display="inline"
        onPress={() => accept.mutate(requestId)}
        isDisabled={isProcessing}
      >
        {t('list.accept')}
      </Button>
      <Button
        variant="weak"
        color="danger"
        size="small"
        display="inline"
        onPress={() => reject.mutate(requestId)}
        isDisabled={isProcessing}
      >
        {t('list.reject')}
      </Button>
    </HStack>
  );
};

ReceivedRequestList.Loading = function Loading() {
  return (
    <UserList.Loading
      ListHeaderComponent={
        <Box py={12}>
          <TextSkeleton size="b4" className="w-16" />
        </Box>
      }
      right={
        <HStack gap={8}>
          <Skeleton className="h-8 w-12 rounded-xl" />
          <Skeleton className="h-8 w-12 rounded-xl" />
        </HStack>
      }
    />
  );
};

ReceivedRequestList.Error = UserList.Error;

ReceivedRequestList.Empty = function Empty() {
  const { t } = useTranslation('friend');
  return <UserList.Empty icon={<FriendIllustration />} title={t('list.emptyReceived')} />;
};
