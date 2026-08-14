import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DocsIcon, Result, Text } from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { FriendRequest } from '../../models/friend.model';
import { useCancelRequestMutationOptions } from '../queries/use-cancel-request-mutation-options';
import { useGetSentRequestsQueryOptions } from '../queries/use-get-sent-requests-query-options';
import { UserList } from './UserList';

export function SentRequestList() {
  const { t } = useTranslation(['friend', 'common']);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(useGetSentRequestsQueryOptions());
  const cancelMutation = useMutation(useCancelRequestMutationOptions());
  const [isRefreshing, handleRefresh] = useRefresh(refetch);

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
        const isProcessing = cancelMutation.isPending && cancelMutation.variables === item.id;

        return (
          <UserList.Item
            displayName={item.name ?? item.userTag}
            profileImage={item.profileImage}
            action={
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
      emptyContent={
        <Result icon={<DocsIcon width={72} height={72} />} title={t('list.emptySent')} />
      }
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onEndReached={fetchNextPage}
      refresh={{ isRefreshing, onRefresh: handleRefresh }}
    />
  );
}

SentRequestList.Loading = function Loading() {
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
