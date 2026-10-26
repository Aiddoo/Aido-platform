import { UserList } from '@src/features/friend/components/user-list';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DocsIcon, Text, useConfirmDialog } from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import type { BlockedUser } from '../domains/user-block.model';
import { useGetBlockedUsersInfiniteQueryOptions } from '../queries/get-blocked-users-infinite-query-options';
import { useUnblockUserMutationOptions } from '../queries/use-unblock-user-mutation-options';

const UNBLOCK_BUTTON_HIT_SLOP = 6;

/** 내가 차단한 사용자. 최근에 차단한 순서로 서버가 준 그대로 보여 준다 */
export function BlockedUserList() {
  const { t } = useTranslation('moderation');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(useGetBlockedUsersInfiniteQueryOptions());
  const [refreshing, onRefresh] = useRefresh(refetch);

  return (
    <UserList
      data={data.blockedUsers}
      keyExtractor={(blockedUser) => blockedUser.id}
      renderItem={({ item }) => <BlockedUserList.Item blockedUser={item} />}
      ListHeaderComponent={
        data.blockedUsers.length > 0 ? (
          <Box py={12}>
            <Text size="b4" shade={7}>
              {t('blockedUsers.totalCount', { count: data.totalCount })}
            </Text>
          </Box>
        ) : null
      }
      ListEmptyComponent={<BlockedUserList.Empty />}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

BlockedUserList.Item = function Item({ blockedUser }: { blockedUser: BlockedUser }) {
  const { t } = useTranslation(['moderation', 'common']);
  const confirmDialog = useConfirmDialog();
  const unblockUser = useMutation(useUnblockUserMutationOptions());
  const dateFormatContext = useDateFormatContext();
  const displayName = blockedUser.name ?? t('moderation:fallbackName');

  const handleUnblock = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('moderation:unblock.confirmTitle', { name: displayName }),
      description: t('moderation:unblock.confirmDescription'),
      confirmLabel: t('moderation:unblock.confirm'),
      cancelLabel: t('common:actions.cancel'),
      confirmTestID: 'blocked-user-unblock-confirm',
    });
    if (!isConfirmed) {
      return;
    }
    unblockUser.mutate({ userId: blockedUser.id, displayName });
  };

  return (
    <UserList.Item
      displayName={displayName}
      subtitle={t('moderation:blockedUsers.subtitle', {
        userTag: blockedUser.userTag,
        date: formatDateLabel(blockedUser.blockedAt, 'monthDay', dateFormatContext),
      })}
      profileImage={blockedUser.profileImage}
      right={
        <Button
          variant="weak"
          color="dark"
          size="small"
          display="inline"
          hitSlop={UNBLOCK_BUTTON_HIT_SLOP}
          isLoading={unblockUser.isPending}
          onPress={handleUnblock}
          testID={`blocked-user-unblock-${blockedUser.id}`}
        >
          {t('moderation:unblock.action')}
        </Button>
      }
    />
  );
};

BlockedUserList.Loading = function Loading() {
  return (
    <UserList.Loading
      rows={6}
      hasSubtitle
      right={<Skeleton className="h-8 w-[72px] rounded-full" />}
    />
  );
};

BlockedUserList.Error = UserList.Error;

BlockedUserList.Empty = function Empty() {
  const { t } = useTranslation('moderation');

  return (
    <UserList.Empty
      icon={<DocsIcon width={72} height={72} />}
      title={t('blockedUsers.emptyTitle')}
      description={t('blockedUsers.emptyDescription')}
      testID="blocked-users-empty"
    />
  );
};
