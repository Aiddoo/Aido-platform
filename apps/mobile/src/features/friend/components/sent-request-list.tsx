import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DocsIcon, Text, TextSkeleton } from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { FriendRequest } from '../domains/friend.model';
import { useGetSentRequestsQueryOptions } from '../queries/get-sent-requests-query-options';
import { useCancelRequestMutationOptions } from '../queries/use-cancel-request-mutation-options';
import { UserList } from './user-list';

export function SentRequestList() {
  const { t } = useTranslation('friend');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(useGetSentRequestsQueryOptions());
  const [refreshing, onRefresh] = useRefresh(refetch);

  const requests = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  return (
    <UserList
      data={requests}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <SentRequestList.Item request={item} />}
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
      fetchNextPage={fetchNextPage}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

SentRequestList.Item = function Item({ request }: { request: FriendRequest }) {
  const { t } = useTranslation('common');
  const cancel = useMutation(useCancelRequestMutationOptions());

  return (
    <UserList.Item
      displayName={request.name ?? request.userTag}
      profileImage={request.profileImage}
      right={
        <Button
          variant="weak"
          color="danger"
          size="small"
          display="inline"
          onPress={() => cancel.mutate(request.id)}
          isDisabled={cancel.isPending}
        >
          {t('actions.cancel')}
        </Button>
      }
    />
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
  return <UserList.Empty icon={<DocsIcon width={72} height={72} />} title={t('list.emptySent')} />;
};
