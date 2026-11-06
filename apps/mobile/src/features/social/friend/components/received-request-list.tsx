import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DocsIcon, HStack, Text, TextSkeleton } from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { FriendRequest } from '../domains/friend.model';
import { useGetReceivedRequestsQueryOptions } from '../queries/get-received-requests-query-options';
import { useAcceptRequestMutationOptions } from '../queries/use-accept-request-mutation-options';
import { useRejectRequestMutationOptions } from '../queries/use-reject-request-mutation-options';
import { UserList } from './user-list';

export function ReceivedRequestList() {
  const { t } = useTranslation('friend');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(useGetReceivedRequestsQueryOptions());
  const [refreshing, onRefresh] = useRefresh(refetch);

  const requests = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  return (
    <UserList
      data={requests}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ReceivedRequestList.Item request={item} />}
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
      fetchNextPage={fetchNextPage}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

ReceivedRequestList.Item = function Item({ request }: { request: FriendRequest }) {
  const { t } = useTranslation('friend');
  const accept = useMutation(useAcceptRequestMutationOptions());
  const reject = useMutation(useRejectRequestMutationOptions());
  const isProcessing = accept.isPending || reject.isPending;

  return (
    <UserList.Item
      displayName={request.name ?? request.userTag}
      profileImage={request.profileImage}
      right={
        <HStack gap={8}>
          <Button
            variant="weak"
            color="dark"
            size="small"
            display="inline"
            onPress={() => accept.mutate(request.id)}
            isDisabled={isProcessing}
          >
            {t('list.accept')}
          </Button>
          <Button
            variant="weak"
            color="danger"
            size="small"
            display="inline"
            onPress={() => reject.mutate(request.id)}
            isDisabled={isProcessing}
          >
            {t('list.reject')}
          </Button>
        </HStack>
      }
    />
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
  return (
    <UserList.Empty icon={<DocsIcon width={72} height={72} />} title={t('list.emptyReceived')} />
  );
};
