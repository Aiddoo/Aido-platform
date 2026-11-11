import { UserList } from '@src/features/identity/user/components/user-list';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  FriendIllustration,
  InfiniteList,
  ListRow,
  SettingsListGroup,
  TextSkeleton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { Fragment } from 'react';

import type { BlockedUser } from '../domains/user-block.model';
import { useUnblockUserMutationOptions } from '../queries/moderation.mutations';
import { useGetBlockedUsersInfiniteQueryOptions } from '../queries/moderation.queries';

const UNBLOCK_BUTTON_HIT_SLOP = 6;
const LOADING_ROW_COUNT = 6;
/** `SettingsScreenLayout`과 같은 위아래 여백. 가상 목록이라 내용에 둔다 */
const BLOCKED_USER_LIST_CONTENT_STYLE = { flexGrow: 1, paddingTop: 20, paddingBottom: 16 };

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
      renderItem={({ item, index }) => (
        <SettingsListGroup.Segment
          label={t('blockedUsers.totalCount', { count: data.totalCount })}
          isFirst={index === 0}
          isLast={index === data.blockedUsers.length - 1}
        >
          <BlockedUserList.Item blockedUser={item} />
        </SettingsListGroup.Segment>
      )}
      contentContainerStyle={BLOCKED_USER_LIST_CONTENT_STYLE}
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
  const todayKey = useTodayKey();
  const displayName = blockedUser.name ?? t('fallbackName');

  return (
    <UserList.Item
      displayName={displayName}
      subtitle={t('blockedUsers.subtitle', {
        userTag: blockedUser.userTag,
        date: formatYearAwareDateLabel(blockedUser.blockedAt, todayKey, dateFormatContext),
      })}
      profileImage={blockedUser.profileImage}
      horizontalPadding="medium"
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
    const isConfirmed = await confirmDialog.openAsync({
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
    <VStack className="pt-5">
      <SettingsListGroup>
        <TextSkeleton size="b2" className="mx-4 mb-1 mt-4 w-16" />
        {range(LOADING_ROW_COUNT).map((index) => (
          <Fragment key={index}>
            {index > 0 && <SettingsListGroup.Separator />}
            <ListRow
              left={<Skeleton className="size-10 rounded-full" />}
              contents={<ListRow.Texts.Loading type="2RowTypeA" />}
              right={<Skeleton className="h-8 w-[72px] rounded-full" />}
              horizontalPadding="medium"
            />
          </Fragment>
        ))}
      </SettingsListGroup>
    </VStack>
  );
};

BlockedUserList.Error = UserList.Error;

BlockedUserList.Empty = function Empty() {
  const { t } = useTranslation('moderation');

  return (
    <SettingsListGroup.Empty
      icon={<FriendIllustration size="block" />}
      title={t('blockedUsers.emptyTitle')}
      description={t('blockedUsers.emptyDescription')}
      testID="blocked-users-empty"
    />
  );
};
