import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DocsIcon, HStack, Result, Text } from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { FriendRequest } from '../../models/friend.model';
import { useAcceptRequestMutationOptions } from '../queries/use-accept-request-mutation-options';
import { useGetReceivedRequestsQueryOptions } from '../queries/use-get-received-requests-query-options';
import { useRejectRequestMutationOptions } from '../queries/use-reject-request-mutation-options';
import { UserList } from './UserList';

export function ReceivedRequestList() {
  const { t } = useTranslation('friend');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(useGetReceivedRequestsQueryOptions());
  const acceptMutation = useMutation(useAcceptRequestMutationOptions());
  const [isRefreshing, handleRefresh] = useRefresh(refetch);
  const rejectMutation = useMutation(useRejectRequestMutationOptions());

  const allRequests = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  return (
    <UserList
      data={allRequests}
      keyExtractor={(item) => item.id}
      header={
        <Box py={12}>
          <Text size="b4" shade={6}>
            {t('list.requestCount', { count: totalCount })}
          </Text>
        </Box>
      }
      renderItem={(item: FriendRequest) => {
        const isProcessing =
          (acceptMutation.isPending && acceptMutation.variables === item.id) ||
          (rejectMutation.isPending && rejectMutation.variables === item.id);

        return (
          <UserList.Item
            displayName={item.name ?? item.userTag}
            profileImage={item.profileImage}
            action={
              <HStack gap={8}>
                <Button
                  variant="weak"
                  color="dark"
                  size="small"
                  display="inline"
                  onPress={() => acceptMutation.mutate(item.id)}
                  disabled={isProcessing}
                >
                  {t('list.accept')}
                </Button>
                <Button
                  variant="weak"
                  color="danger"
                  size="small"
                  display="inline"
                  onPress={() => rejectMutation.mutate(item.id)}
                  disabled={isProcessing}
                >
                  {t('list.reject')}
                </Button>
              </HStack>
            }
          />
        );
      }}
      emptyContent={
        <Result icon={<DocsIcon width={72} height={72} />} title={t('list.emptyReceived')} />
      }
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onEndReached={fetchNextPage}
      refresh={{ isRefreshing, onRefresh: handleRefresh }}
    />
  );
}

ReceivedRequestList.Loading = function Loading() {
  return (
    <UserList.Loading
      header={
        <Box py={12}>
          <Skeleton className="w-16 h-4" />
        </Box>
      }
    />
  );
};
