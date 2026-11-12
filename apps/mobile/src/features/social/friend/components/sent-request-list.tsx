import {
  USER_LIST_CONTENT_STYLE,
  UserList,
} from '@src/features/identity/user/components/user-list';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, FriendIllustration, InfiniteList, Text, TextSkeleton } from '@src/shared/ui';
import { useMutation, useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { FriendRequest } from '../domains/friend.model';
import { refreshFriends } from '../queries/friend-cache';
import { useCancelRequestMutationOptions } from '../queries/friend.mutations';
import { useGetSentRequestsInfiniteQueryOptions } from '../queries/friend.queries';

export function SentRequestList() {
  const { t } = useTranslation('friend');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
    useSuspenseInfiniteQuery(useGetSentRequestsInfiniteQueryOptions());
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshFriends(queryClient));

  const { items: requests, totalCount } = data;

  return (
    <InfiniteList
      data={requests}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <SentRequestList.Item request={item} />}
      contentContainerStyle={USER_LIST_CONTENT_STYLE}
      ListHeaderComponent={
        <Box py={12}>
          <Text size="b4" shade={6}>
            {t('list.requestCount', { count: totalCount })}
          </Text>
        </Box>
      }
      ListEmptyComponent={<SentRequestList.Empty />}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}

SentRequestList.Item = function Item({ request }: { request: FriendRequest }) {
  return (
    <UserList.Item
      displayName={request.name ?? request.userTag}
      profileImage={request.profileImage}
      right={<SentRequestList.CancelButton key={request.id} requestId={request.id} />}
    />
  );
};

/** 목록이 행을 재활용해도 취소 중 상태가 다른 요청으로 넘어가지 않게 요청마다 새로 만든다 */
SentRequestList.CancelButton = function CancelButton({ requestId }: { requestId: string }) {
  const { t } = useTranslation('common');
  const cancel = useMutation(useCancelRequestMutationOptions());

  return (
    <Button
      variant="weak"
      color="danger"
      size="small"
      display="inline"
      onPress={() => cancel.mutate(requestId)}
      isDisabled={cancel.isPending}
    >
      {t('actions.cancel')}
    </Button>
  );
};

SentRequestList.Loading = function Loading() {
  return (
    <UserList.Loading
      ListHeaderComponent={
        <Box py={12}>
          <TextSkeleton size="b4" className="w-16" />
        </Box>
      }
      right={<Skeleton className="h-8 w-12 rounded-xl" />}
    />
  );
};

SentRequestList.Error = UserList.Error;

SentRequestList.Empty = function Empty() {
  const { t } = useTranslation('friend');
  return <UserList.Empty icon={<FriendIllustration />} title={t('list.emptySent')} />;
};
