import {
  USER_LIST_CONTENT_STYLE,
  UserList,
} from '@src/features/social/friend/components/user-list';
import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DocsIcon, InfiniteList, Text, useConfirmDialog } from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';

import { useUnblockUserMutationOptions } from '../queries/moderation.mutations';
import { useGetBlockedUsersInfiniteQueryOptions } from '../queries/moderation.queries';
import type { BlockedUser } from '../schemas/user-block.schema';

const UNBLOCK_BUTTON_HIT_SLOP = 6;

/** 내가 차단한 사용자. 최근에 차단한 순서로 서버가 준 그대로 보여 준다 */
export function BlockedUserList() {
  const { t } = useTranslation('moderation');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
    useSuspenseInfiniteQuery(useGetBlockedUsersInfiniteQueryOptions());
  const [isRefreshing, handleRefresh] = useRefresh(refetch);

  return (
    <InfiniteList
      data={data.blockedUsers}
      keyExtractor={(blockedUser) => blockedUser.id}
      renderItem={({ item }) => <BlockedUserList.Item blockedUser={item} />}
      contentContainerStyle={USER_LIST_CONTENT_STYLE}
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
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}

BlockedUserList.Item = function Item({ blockedUser }: { blockedUser: BlockedUser }) {
  const { t } = useTranslation('moderation');
  const dateFormatContext = useDateFormatContext();
  const displayName = blockedUser.name ?? t('fallbackName');

  return (
    <UserList.Item
      displayName={displayName}
      subtitle={t('blockedUsers.subtitle', {
        userTag: blockedUser.userTag,
        date: formatDateLabel(blockedUser.blockedAt, 'monthDay', dateFormatContext),
      })}
      profileImage={blockedUser.profileImage}
      right={
        <BlockedUserList.UnblockButton
          key={blockedUser.id}
          userId={blockedUser.id}
          displayName={displayName}
        />
      }
    />
  );
};

/** 목록이 행을 재활용해도 해제 중 상태가 다른 사용자로 넘어가지 않게 사용자마다 새로 만든다 */
BlockedUserList.UnblockButton = function UnblockButton({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const { t } = useTranslation(['moderation', 'common']);
  const confirmDialog = useConfirmDialog();
  const unblockUser = useMutation(useUnblockUserMutationOptions());

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
    unblockUser.mutate({ userId, displayName });
  };

  return (
    <Button
      variant="weak"
      color="dark"
      size="small"
      display="inline"
      hitSlop={UNBLOCK_BUTTON_HIT_SLOP}
      isLoading={unblockUser.isPending}
      onPress={handleUnblock}
      testID={`blocked-user-unblock-${userId}`}
    >
      {t('moderation:unblock.action')}
    </Button>
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
