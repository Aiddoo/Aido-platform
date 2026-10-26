import type { RedemptionStatus } from '@aido/api';
import { UserList } from '@src/features/friend/components/user-list';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { PawIcon, type Result } from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import type { ComponentProps, ReactElement } from 'react';
import { ScrollView } from 'react-native';

import type { InvitedFriend } from '../domains/invited-friend.model';
import { useGetInvitedFriendsInfiniteQueryOptions } from '../queries/get-invited-friends-infinite-query-options';
import { invalidateInvite } from '../queries/invite-cache';
import { InvitedFriendRow } from './invited-friend-row';

interface InvitedFriendListProps {
  /** 이 상태의 친구만 보여 준다. 없으면 전체다 */
  status?: RedemptionStatus;
  ListEmptyComponent?: ReactElement;
}

/** 내가 초대한 친구 전체. 늘어날 수 있어 친구 목록과 같은 무한 스크롤 FlashList를 쓴다 */
export function InvitedFriendList({
  status,
  ListEmptyComponent = <InvitedFriendList.Empty />,
}: InvitedFriendListProps) {
  const queryClient = useQueryClient();
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    useGetInvitedFriendsInfiniteQueryOptions({ status: status ?? null }),
  );
  // 발자국 요약(탭 숫자)과 목록을 함께 새로 고친다
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateInvite(queryClient));

  return (
    <UserList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListEmptyComponent={ListEmptyComponent}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}

function keyExtractor(friend: InvitedFriend) {
  return friend.userId;
}

function renderItem({ item }: { item: InvitedFriend }) {
  return <InvitedFriendRow friend={item} />;
}

InvitedFriendList.Loading = function Loading() {
  return (
    <ScrollView className="flex-1">
      {times(4, (index) => (
        <InvitedFriendRow.Loading key={index} />
      ))}
    </ScrollView>
  );
};

InvitedFriendList.Error = UserList.Error;

InvitedFriendList.Empty = function Empty(props: Partial<ComponentProps<typeof Result>>) {
  const { t } = useTranslation('invite');

  return (
    <UserList.Empty
      icon={<PawIcon width={36} height={36} colorClassName="text-gray-3" />}
      title={t('friendList.emptyTitle')}
      description={t('friendList.emptyDescription')}
      {...props}
    />
  );
};
